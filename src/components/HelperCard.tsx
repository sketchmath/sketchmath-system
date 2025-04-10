import { Box, TLShapeId, exportToBlob, useValue } from 'tldraw'
import RecordButton from './RecordButton'
import { useContext, useEffect, useState } from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { InterfaceContext, MessageObject } from '@/pages/interface'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { OCRResponse, Term } from '@/pages/api/vision'
import { BoundingBox, calculateOverlapPercentage, MathpixResponse } from '@/lib/utils'
import { Textarea } from './ui/textarea'
import { getDownloadURL, ref, uploadString } from 'firebase/storage'
import firebaseStorage from '@/utils/firebaseStorage'

export type EquationWithTermsType = {
  id: string;
  latex: string;
  boundingBox: BoundingBox;
  terms?: Term[];
}

export const HelperCard = () => {
  const [responseLoading, setResponseLoading] = useState(false);
  const [messages, setMessages] = useState<MessageObject[][]>([[], [], []]);
  const { tldrawEditor, currentQuestion, setLlmResponse, userQuestion, setUserQuestion, isRecording, isTranscriptionProcessing, setAnnotationToExplanationMap, annotationToExplanationMap, setMessageHistory, messageHistory, setSystemInteractionLog } = useContext(InterfaceContext);

  useEffect(() => {
    setSystemInteractionLog((prev) => ({
      ...prev,
      q0Messages: messages[0],
      q1Messages: messages[1],
      q2Messages: messages[2],
    }));
  }, [messages]);

  const exportImage = async () => {
    if (tldrawEditor) {
      const questionTextId = `shape:question-${currentQuestion}-text` as TLShapeId;
      const shapes = tldrawEditor.getCurrentPageShapes();
      const questionTextShape = shapes.find((shape) => shape.type === 'text' && shape.id === questionTextId);

      if (!questionTextShape) {
        console.error('Could not find question text shape');
        return;
      }

      try {
        await new Promise(resolve => requestAnimationFrame(resolve));

        // delete all shapes that start with shape:annotated or shape:annotation
        shapes.forEach((shape) => {
          if (shape.id.startsWith('shape:annotated') || shape.id.startsWith('shape:annotation')) {
            tldrawEditor.deleteShape(shape.id);
          }
        });

        const tempShapeIds = tldrawEditor.getCurrentPageShapes().map((shape) => shape.id);

        // shapeIds without question text, ids starting with shape:annotated, or ids starting with shape:annotation
        const filteredShapeIds = tempShapeIds.filter((id) => id !== questionTextId && !id.startsWith('shape:annotated') && !id.startsWith('shape:annotation')).map((id) => id);

        if (filteredShapeIds.length === 0) {
          setResponseLoading(true);

          const blobWithQuestion = await exportToBlob({
            editor: tldrawEditor,
            ids: tempShapeIds,
            format: 'jpeg',
            opts: {
              padding: 10,
              background: true,
              scale: 0.5,
            }
          });
          const base64ImageWithQuestion = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobWithQuestion);
          });

          const visionResponse = await fetch('/api/vision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              base64Image: base64ImageWithQuestion,
            }),
          });

          const visionResponseData: OCRResponse = await visionResponse.json();

          // Upload image once and store the URL for later use
          let imageUrl = "";
          let hasExistingMessage = messages[currentQuestion]?.find((message) => message.role === 'user' && message.content === userQuestion);

          if (!hasExistingMessage && base64ImageWithQuestion && base64ImageWithQuestion.includes(',')) {
            const userId = localStorage.getItem("userId");
            const messageId = Date.now().toString();
            const imagePath = `users/${userId}/system/q${currentQuestion}/${messageId}_image`;
            const imageRef = ref(firebaseStorage, imagePath);
            const base64Data = base64ImageWithQuestion.split(',')[1];

            if (base64Data) {
              // Upload the image once and store the URL
              await uploadString(imageRef, `data:text/plain;base64,${base64Data}`, 'data_url', {
                contentType: "image/jpg",
              });
              imageUrl = await getDownloadURL(imageRef);

              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (!newMessages[currentQuestion]) {
                  newMessages[currentQuestion] = [];
                }
                if (!newMessages[currentQuestion].find((message) => message.role === 'user' && message.content === userQuestion)) {
                  newMessages[currentQuestion].push({
                    id: messageId,
                    timestamp: new Date(),
                    role: 'user',
                    content: userQuestion,
                    imageUrl,
                  });
                }
                return newMessages;
              });
            }
          }

          setMessageHistory(prevMessages => {
            const newMessages = [...prevMessages];
            if (!newMessages[currentQuestion]) {
              newMessages[currentQuestion] = [];
            }
            if (!newMessages[currentQuestion].find((message) => message.role === 'user' && message.content === userQuestion)) {
              newMessages[currentQuestion].push({
                content: userQuestion,
                role: "user",
              });
            }
            return newMessages;
          });

          const analyzeResponse = await fetch('/api/analyze-question', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              whiteboardImage: base64ImageWithQuestion,
              visionData: JSON.stringify(visionResponseData.equations),
              questionNumber: currentQuestion,
              userQuestion,
              messageHistory,
            }),
          });

          const analyzeResponseData = await analyzeResponse.json();
          let { overallFeedback, annotations } = analyzeResponseData;

          const verifyResponse = await fetch('/api/verify-question', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              whiteboardImage: base64ImageWithQuestion,
              visionData: JSON.stringify(visionResponseData.equations),
              questionNumber: currentQuestion,
              userQuestion,
              messageHistory,
              annotations: analyzeResponseData,
            }),
          });

          const verifyResponseData = await verifyResponse.json();
          overallFeedback = verifyResponseData.overallFeedback;
          annotations = verifyResponseData.annotations;

          console.log(verifyResponseData);

          // find topLeftX and topLeftY of the tempShapeIds
          let topLeftX = Infinity;
          let topLeftY = Infinity;

          tempShapeIds.forEach((id) => {
            const shape = tldrawEditor.getShape(id);
            if (shape) {
              topLeftX = Math.min(topLeftX, shape.x);
              topLeftY = Math.min(topLeftY, shape.y);
            }
          });

          annotations.termsToAnno.forEach((termObj: any) => {
            const term = visionResponseData.equations?.flatMap(equation => equation.terms || []).find(term => term.id === termObj.termId);
            if (!term) {
              console.error('Term not found:', termObj.termId);
              return;
            }
            const equationBoundingBox = term.boundingBox;
            const annotationExplanation = termObj.termExp;

            const padding = 5;
            const xOffset = 10;
            const yOffset = 10;
            const bounds = new Box(
              topLeftX + equationBoundingBox.x - padding - xOffset,
              topLeftY + equationBoundingBox.y - padding - yOffset,
              equationBoundingBox.width + (padding * 2),
              equationBoundingBox.height + (padding * 2)
            );

            const newShape = {
              id: `shape:annotated-question-${term.id}` as TLShapeId,
              type: 'geo',
              x: bounds.x,
              y: bounds.y,
              props: {
                w: bounds.width,
                h: bounds.height,
                color: 'blue',
                fill: 'none',
              },
            };

            setAnnotationToExplanationMap((map) => ({
              ...map,
              [newShape.id]: annotationExplanation,
            }));

            tldrawEditor.createShape(newShape);
          });

          // get all shape ids
          const allShapeIds = tldrawEditor.getCurrentPageShapes().map((shape) => shape.id);

          // export all shapes
          const blobForDb = await exportToBlob({
            editor: tldrawEditor,
            ids: allShapeIds,
            format: 'jpeg',
            opts: {
              padding: 10,
              background: true,
              scale: 0.5,
            }
          });

          const base64ImageForDb = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobForDb);
          });

          imageUrl = "";
          hasExistingMessage = messages[currentQuestion]?.find((message) => message.role === 'assistant' && message.content === overallFeedback);

          if (!hasExistingMessage && base64ImageForDb && base64ImageForDb.includes(',')) {
            const userId = localStorage.getItem("userId");
            const messageId = Date.now().toString();
            const imagePath = `users/${userId}/system/q${currentQuestion}/${messageId}_image`;
            const imageRef = ref(firebaseStorage, imagePath);
            const base64Data = base64ImageForDb.split(',')[1];

            if (base64Data) {
              // Upload the image once and store the URL
              await uploadString(imageRef, `data:text/plain;base64,${base64Data}`, 'data_url', {
                contentType: "image/jpg",
              });
              imageUrl = await getDownloadURL(imageRef);

              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (!newMessages[currentQuestion]) {
                  newMessages[currentQuestion] = [];
                }
                if (!newMessages[currentQuestion].find((message) => message.role === 'assistant' && message.content === overallFeedback)) {
                  newMessages[currentQuestion].push({
                    id: messageId,
                    timestamp: new Date(),
                    role: 'assistant',
                    content: overallFeedback,
                    imageUrl,
                    annotations
                  });
                }
                return newMessages;
              });
            }
          }

          setLlmResponse(overallFeedback);

          setMessageHistory(prevMessages => {
            const newMessages = [...prevMessages];
            if (!newMessages[currentQuestion]) {
              newMessages[currentQuestion] = [];
            }
            if (!newMessages[currentQuestion].find((message) => message.role === 'assistant' && message.content === overallFeedback)) {
              newMessages[currentQuestion].push({
                content: `${overallFeedback}`,
                imageUrls: [base64ImageForDb],
                role: "assistant",
              });
            }
            return newMessages;
          });

          setResponseLoading(false);
        } else {
          const blobWithoutQuestion = await exportToBlob({
            editor: tldrawEditor,
            ids: filteredShapeIds,
            format: 'jpeg',
            opts: {
              padding: 10,
              background: true,
              scale: 0.5,
            }
          });

          const blobWithQuestion = await exportToBlob({
            editor: tldrawEditor,
            ids: tempShapeIds,
            format: 'jpeg',
            opts: {
              padding: 10,
              background: true,
              scale: 0.5,
            }
          });

          setResponseLoading(true);
          // Convert blob to base64
          const base64ImageWithoutQuestion = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobWithoutQuestion);
          });

          // download base64 image
          // const link = document.createElement('a');
          // link.href = base64ImageWithoutQuestion;
          // link.download = 'test.jpeg';
          // link.click();

          const base64ImageWithQuestion = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobWithQuestion);
          });

          const mathpixResponse = await fetch('/api/mathpix', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              imageData: base64ImageWithoutQuestion,
            }),
          });

          const mathpixResponseData: MathpixResponse = await mathpixResponse.json();

          const visionResponse = await fetch('/api/vision', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              base64Image: base64ImageWithoutQuestion,
            }),
          });

          const visionResponseData: OCRResponse = await visionResponse.json();

          // Find the top-left-most coordinate of the filtered shapes
          let topLeftX = Infinity;
          let topLeftY = Infinity;

          filteredShapeIds.forEach((id) => {
            const shape = tldrawEditor.getShape(id);
            if (shape) {
              topLeftX = Math.min(topLeftX, shape.x);
              topLeftY = Math.min(topLeftY, shape.y);
            }
          });

          // mathpixResponseData.equations?.forEach((equation) => {
          //   const equationBoundingBox = equation.boundingBox;
          //   const padding = 10;
          //   const bounds = new Box(
          //     topLeftX + equationBoundingBox.x - 10 - padding,
          //     topLeftY + equationBoundingBox.y - 10 - padding,
          //     equationBoundingBox.width + (padding * 2),
          //     equationBoundingBox.height + (padding * 2)
          //   );

          //   tldrawEditor.createShape({
          //     type: 'geo',
          //     x: bounds.x,
          //     y: bounds.y,
          //     props: {
          //       w: bounds.width,
          //       h: bounds.height,
          //       color: 'green',
          //       fill: 'none',
          //     },
          //   });
          // });

          // make a copy of mathpixResponseData.equations
          const eqs: EquationWithTermsType[] = [...mathpixResponseData.equations!];

          visionResponseData.equations?.forEach((equation) => {
            // box all terms in purple
            equation.terms?.forEach((term) => {
              const termBoundingBox = term.boundingBox;
              // const xOffset = termBoundingBox.width * 0.15;
              // const yOffset = termBoundingBox.height * 0.15;
              // const padding = 10;
              // const bounds = new Box(
              //   topLeftX + termBoundingBox.x - xOffset - padding,
              //   topLeftY + termBoundingBox.y - yOffset - padding,
              //   termBoundingBox.width + (padding * 2),
              //   termBoundingBox.height + (padding * 2)
              // );

              const equationWithTerm = eqs.find((eq) => {
                const overlapPercentage = calculateOverlapPercentage(eq.boundingBox, termBoundingBox);
                return overlapPercentage > 0.65;
              });

              if (equationWithTerm) {
                const indexOfEquation = eqs.indexOf(equationWithTerm);

                if (eqs[indexOfEquation].terms) {
                  eqs[indexOfEquation].terms.push({
                    ...term,
                    id: `${eqs[indexOfEquation].id}-term-${term.id.split('-')[3]}`,
                  });
                } else {
                  eqs[indexOfEquation].terms = [{
                    ...term,
                    id: `${eqs[indexOfEquation].id}-term-${term.id.split('-')[3]}`,
                  }];
                }
              }

              // tldrawEditor.createShape({
              //   type: 'geo',
              //   x: bounds.x,
              //   y: bounds.y,
              //   props: {
              //     w: bounds.width,
              //     h: bounds.height,
              //     color: 'violet',
              //     fill: 'none',
              //   },
              // });
            });
          });

          const correctionResponse = await fetch('/api/new-correction', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              whiteboardImage: base64ImageWithoutQuestion,
              eqsData: JSON.stringify(eqs),
            }),
          });

          const correctionResponseData = await correctionResponse.json();
          const correctedEquations: EquationWithTermsType[] = correctionResponseData.correctedEquations;

          // have a 1 second delay here
          await new Promise((resolve) => setTimeout(resolve, 750));

          let imageUrl = "";
          let hasExistingMessage = messages[currentQuestion]?.find((message) => message.role === 'user' && message.content === userQuestion);

          if (!hasExistingMessage && base64ImageWithQuestion && base64ImageWithQuestion.includes(',')) {
            const userId = localStorage.getItem("userId");
            const messageId = Date.now().toString();
            const imagePath = `users/${userId}/system/q${currentQuestion}/${messageId}_image`;
            const imageRef = ref(firebaseStorage, imagePath);
            const base64Data = base64ImageWithQuestion.split(',')[1];

            if (base64Data) {
              // Upload the image once and store the URL
              await uploadString(imageRef, `data:text/plain;base64,${base64Data}`, 'data_url', {
                contentType: "image/jpg",
              });
              imageUrl = await getDownloadURL(imageRef);

              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (!newMessages[currentQuestion]) {
                  newMessages[currentQuestion] = [];
                }
                if (!newMessages[currentQuestion].find((message) => message.role === 'user' && message.content === userQuestion)) {
                  newMessages[currentQuestion].push({
                    id: messageId,
                    timestamp: new Date(),
                    role: 'user',
                    content: userQuestion,
                    imageUrl,
                  });
                }
                return newMessages;
              });
            }
          }

          setMessageHistory(prevMessages => {
            const newMessages = [...prevMessages];
            if (!newMessages[currentQuestion]) {
              newMessages[currentQuestion] = [];
            }
            if (!newMessages[currentQuestion].find((message) => message.role === 'user' && message.content === userQuestion)) {
              newMessages[currentQuestion].push({
                content: userQuestion,
                imageUrls: [base64ImageWithQuestion],
                role: "user",
              });
            }
            return newMessages;
          });

          const analyzeResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              whiteboardImage: base64ImageWithQuestion,
              visionData: JSON.stringify(correctedEquations),
              questionNumber: currentQuestion,
              userQuestion,
              messageHistory,
            }),
          });

          const analyzeResponseData = await analyzeResponse.json();
          const { overallFeedback, annotations } = analyzeResponseData;

          // const verifyResponse = await fetch('/api/verify', {
          //   method: 'POST',
          //   headers: {
          //     'Content-Type': 'application/json',
          //   },
          //   body: JSON.stringify({
          //     whiteboardImage: base64ImageWithQuestion,
          //     visionData: JSON.stringify(visionResponseData.equations),
          //     questionNumber: currentQuestion,
          //     userQuestion,
          //     messageHistory,
          //     annotations: analyzeResponseData,
          //   }),
          // });

          // const verifyResponseData = await verifyResponse.json();
          // overallFeedback = verifyResponseData.overallFeedback;
          // annotations = verifyResponseData.annotations;

          // create boxes based on the equationIds and symbolIds
          annotations.annos.forEach((annotation: any) => {

            annotation.eqsToAnno.forEach((eqObj: any) => {
              const equation = correctedEquations.find((equation) => equation.id === eqObj.eqId);
              if (!equation) {
                console.error('Equation not found:', eqObj.eqId);
                return;
              }
              const equationBoundingBox = equation.boundingBox;
              const annotationExplanation = eqObj.annoExp;
              const annotationColor = eqObj.annoColor;

              const padding = 10;
              const xOffset = 10;
              const yOffset = 10;
              const bounds = new Box(
                topLeftX + equationBoundingBox.x - padding - xOffset,
                topLeftY + equationBoundingBox.y - padding - yOffset,
                equationBoundingBox.width + (padding * 2),
                equationBoundingBox.height + (padding * 2)
              );

              const newShape = {
                id: `shape:annotated-${annotationColor}-${equation.id}` as TLShapeId,
                type: 'geo',
                x: bounds.x,
                y: bounds.y,
                props: {
                  w: bounds.width,
                  h: bounds.height,
                  color: annotationColor,
                  fill: 'none',
                },
              };

              setAnnotationToExplanationMap((map) => ({
                ...map,
                [newShape.id]: annotationExplanation,
              }));

              tldrawEditor.createShape(newShape);
            });

            annotation.termsToAnno.forEach((termObj: any) => {
              // find the term ID in correctedEquations
              const term = correctedEquations.flatMap(equation => equation.terms || [])
                .find(term => term.id === termObj.termId);
              if (!term) {
                console.error('Term not found:', termObj.termId);
                return;
              }
              const termBoundingBox = term.boundingBox;
              const annotationExplanation = termObj.annoExp;
              const annotationColor = termObj.annoColor;

              const padding = 5;
              const xOffset = termBoundingBox.width * 0.1;
              const yOffset = termBoundingBox.height * 0.1;
              const bounds = new Box(
                topLeftX + termBoundingBox.x - padding - xOffset,
                topLeftY + termBoundingBox.y - padding - yOffset,
                termBoundingBox.width + (padding * 2),
                termBoundingBox.height + (padding * 2)
              );

              const newShape = {
                id: `shape:annotated-${annotationColor}-${term.id}` as TLShapeId,
                type: 'geo',
                x: bounds.x,
                y: bounds.y,
                props: {
                  w: bounds.width,
                  h: bounds.height,
                  color: annotationColor,
                  fill: 'none',
                },
              };

              setAnnotationToExplanationMap((map) => ({
                ...map,
                [newShape.id]: annotationExplanation,
              }));

              tldrawEditor.createShape(newShape);
            });
          });

          // get all shape ids
          const allShapeIds = tldrawEditor.getCurrentPageShapes().map((shape) => shape.id);

          // export all shapes
          const blobForDb = await exportToBlob({
            editor: tldrawEditor,
            ids: allShapeIds,
            format: 'jpeg',
            opts: {
              padding: 10,
              background: true,
              scale: 0.5,
            }
          });

          const base64ImageForDb = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blobForDb);
          });

          imageUrl = "";
          hasExistingMessage = messages[currentQuestion]?.find((message) => message.role === 'assistant' && message.content === overallFeedback);

          if (!hasExistingMessage && base64ImageForDb && base64ImageForDb.includes(',')) {
            const userId = localStorage.getItem("userId");
            const messageId = Date.now().toString();
            const imagePath = `users/${userId}/system/q${currentQuestion}/${messageId}_image`;
            const imageRef = ref(firebaseStorage, imagePath);
            const base64Data = base64ImageForDb.split(',')[1];

            if (base64Data) {
              // Upload the image once and store the URL
              await uploadString(imageRef, `data:text/plain;base64,${base64Data}`, 'data_url', {
                contentType: "image/jpg",
              });
              imageUrl = await getDownloadURL(imageRef);

              setMessages(prevMessages => {
                const newMessages = [...prevMessages];
                if (!newMessages[currentQuestion]) {
                  newMessages[currentQuestion] = [];
                }
                if (!newMessages[currentQuestion].find((message) => message.role === 'assistant' && message.content === overallFeedback)) {
                  newMessages[currentQuestion].push({
                    id: messageId,
                    timestamp: new Date(),
                    role: 'assistant',
                    content: overallFeedback,
                    imageUrl,
                    annotations
                  });
                }
                return newMessages;
              });
            }
          }

          setLlmResponse(overallFeedback);

          setMessageHistory(prevMessages => {
            const newMessages = [...prevMessages];
            if (!newMessages[currentQuestion]) {
              newMessages[currentQuestion] = [];
            }
            if (!newMessages[currentQuestion].find((message) => message.role === 'assistant' && message.content === overallFeedback)) {
              newMessages[currentQuestion].push({
                content: `${overallFeedback}`,
                imageUrls: [base64ImageForDb],
                role: "assistant",
              });
            }

            return newMessages;
          });

          setResponseLoading(false);
        }

        setUserQuestion('');
      } catch (error) {
        console.error('Error during export process:', error);
        setResponseLoading(false);
      } finally {

      }
    }
  };

  useValue(
    'shapes',
    () => {
      if (tldrawEditor) {
        // const currentlySelectedShapes = tldrawEditor.getSelectedShapes();

        // if (currentlySelectedShapes.length === 1 && currentlySelectedShapes[0].id.startsWith('shape:annotated')) {
        //   setPreviousSelectedAnnotatedShape(currentlySelectedShapes[0].id);
        //   // add a text shape with the annotation explanation next to the selected shape
        //   const selectedShape = currentlySelectedShapes[0];
        //   const shapeId = selectedShape.id;
        //   const annotationExplanation = annotationToExplanationMap![shapeId!];


        //   if (annotationExplanation) {
        //     const bounds = new Box(
        //       selectedShape.type === 'text' ? selectedShape.x + 100 : selectedShape.x + (selectedShape.props as any).w + 10,
        //       selectedShape.y,
        //       100,
        //       30
        //     );

        //     tldrawEditor.createShape({
        //       id: `shape:annotation-text-${shapeId}` as TLShapeId,
        //       type: 'text',
        //       x: bounds.x,
        //       y: bounds.y,
        //       props: {
        //         text: annotationExplanation,
        //         size: 's',
        //         scale: 0.5,
        //         w: 250,
        //         color: (selectedShape.props as any).color,
        //         autoSize: false,
        //       },
        //     });

        //     tldrawEditor.groupShapes([shapeId, `shape:annotation-text-${shapeId}` as TLShapeId], { groupId: `shape:annotation-group-${shapeId}` as TLShapeId });
        //   }

        // }

        // if (currentlySelectedShapes.length === 0 && previousSelectedAnnotatedShape) {
        //   tldrawEditor.deleteShape(`shape:annotation-text-${previousSelectedAnnotatedShape}` as TLShapeId);
        // }
        // if (currentlySelectedShapes.length > 0 && !currentlySelectedShapes[0].id.startsWith('shape:annotation') && currentlySelectedShapes[0].id !== previousSelectedAnnotatedShape) {
        //   tldrawEditor.deleteShape(`shape:annotation-text-${previousSelectedAnnotatedShape}` as TLShapeId);
        // }
      }
    }, [tldrawEditor, annotationToExplanationMap]
  );

  return (
    <Card className="w-full h-full flex-wrap overflow-y-auto">
      <CardHeader className="">
        <CardTitle className="font-bold text-xl">Ask AI</CardTitle>
        <CardDescription>
          Click &apos;Ask&apos; for help.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm flex flex-col w-full gap-2">
        <div className="flex w-full justify-between gap-4 h-full">
          <RecordButton />
          <Button onClick={exportImage} disabled={responseLoading || isRecording || isTranscriptionProcessing}>
            {responseLoading ?
              <LoaderCircleIcon className="animate-spin" />
              : 'Ask'}
          </Button>
        </div>
        <Textarea value={userQuestion} onChange={e => setUserQuestion(e.target.value)} disabled={isRecording} placeholder="Record or type your question here (optional)." className="resize-none h-full w-full" />
      </CardContent>
    </Card>
  );
}
