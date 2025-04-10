import { InterfaceContext } from '@/pages/interface';
import { questions } from '@/utils/questions';
import { useContext, useEffect } from 'react';
import { track, useEditor, useValue, TLShapeId, TLGeoShape } from 'tldraw';

const WhiteboardState = track(() => {
  const editor = useEditor();
  const { currentQuestion, setBoardShapes, boardShapes } = useContext(InterfaceContext);

  useEffect(() => {
    if (!editor) throw new Error('No editor');

    const currentShapes = editor.getCurrentPageShapes();

    if (currentShapes.length <= 1) {
      editor.run(
        () => {
          editor
            .getCurrentPageShapes()
            .forEach((shape) => editor.deleteShape(shape.id));
        },
        { ignoreShapeLock: true }
      )

      // Check if there's already a question shape in the current board shapes
      const hasQuestionShape = boardShapes[currentQuestion]?.some(
        (shape) => shape.id === `shape:question-${currentQuestion}-text`
      );

      // Only add question shape if it doesn't exist already
      if (!hasQuestionShape) {
        editor.createShape({
          id: `shape:question-${currentQuestion}-text` as TLShapeId,
          type: 'text',
          props: {
            text: questions[`q${currentQuestion}`],
            size: 's',
            font: 'sans',
            w: currentQuestion === 0 ? 458 : 750,
            autoSize: false,
          },
        });

        // toggle lock this shape
        editor.toggleLock([`shape:question-${currentQuestion}-text` as TLShapeId]);
      }
      setBoardShapes((prevBoardShapes) => {
        const newBoardShapes = [...prevBoardShapes];
        newBoardShapes[currentQuestion] = editor.getCurrentPageShapes();
        return newBoardShapes;
      });

      // add shapes back to the editor
      editor.createShapes(boardShapes[currentQuestion]);
      // fit the image to the editor
      editor.zoomToFit();
    } else {
      editor.run(
        () => {
          editor
            .getCurrentPageShapes()
            .forEach((shape) => editor.deleteShape(shape.id));
        },
        { ignoreShapeLock: true }
      )
      if (currentShapes.length <= 1) {
        setBoardShapes((prevBoardShapes) => {
          const newBoardShapes = [...prevBoardShapes];
          newBoardShapes[currentQuestion] = currentShapes;
          return newBoardShapes;
        });
      } else {
        setBoardShapes((prevBoardShapes) => {
          const newBoardShapes = [...prevBoardShapes];
          newBoardShapes[currentQuestion === 1 ? 1 : 0] = currentShapes;
          return newBoardShapes;
        });
      }
      // clear the editor
      editor.deleteShapes(currentShapes.map((shape) => shape.id));

      editor.createShape({
        id: `shape:question-${currentQuestion}-text` as TLShapeId,
        type: 'text',
        props: {
          text: questions[`q${currentQuestion}`],
          size: 's',
          font: 'sans',
          w: 750,
          autoSize: false,
        },
      })

      // add shapes back to the editor
      editor.createShapes(boardShapes[currentQuestion]);
      // fit the image to the editor
      editor.zoomToFit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQuestion]);

  useValue(
    'shapes',
    () => {
      if (!editor) throw new Error('No editor');
      const currentShapes = editor.getCurrentPageShapes();

      editor.sideEffects.registerBeforeChangeHandler('shape', (prev, next) => {
        if (prev.id.toString().startsWith('shape:annotated')) {
          if (
            next.x !== prev.x ||
            next.y !== prev.y ||
            next.rotation !== prev.rotation ||
            (next as TLGeoShape).props.w !== (prev as TLGeoShape).props.w ||
            (next as TLGeoShape).props.h !== (prev as TLGeoShape).props.h
          ) {
            return prev
          }
        }
        return next
      })

      return `Shapes: ${currentShapes.map((shape) => shape.id).join(', ')}`;
    },
    [editor]
  );

  return <></>;
});

export default WhiteboardState;
