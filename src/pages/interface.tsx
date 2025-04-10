import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { inter } from '@/utils/fonts';
import { DefaultSizeStyle, Editor, TLComponents, Tldraw } from 'tldraw';
import WhiteboardState from '@/components/WhiteboardState';
import { createContext, Dispatch, SetStateAction, useEffect, useState } from 'react';
import Markdown from 'react-markdown'
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { preprocessLaTeX } from '@/lib/utils';
import 'tldraw/tldraw.css';
import 'katex/dist/katex.min.css';
import { HelperCard } from '@/components/HelperCard';
import { TextToSpeechButton } from '@/components/TextToSpeechButton';
import { scribbleShape } from '@/components/ScribbleShape';
import { Button } from '@/components/ui/button';
import { AnnotationObject } from './api/analyze';
import { ContextToolbarComponent } from '@/components/ContextToolbarComponent';
import firestoreDb from '@/utils/firestore';
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import { DeleteAnnotationsPanel } from '@/components/DeleteAnnotationsPanel';


type InterfaceContextType = {
  currentQuestion: number;
  setCurrentQuestion: Dispatch<SetStateAction<number>>;
  llmResponse: string;
  setLlmResponse: Dispatch<SetStateAction<string>>;
  userQuestion: string;
  setUserQuestion: Dispatch<SetStateAction<string>>;
  isRecording: boolean;
  setIsRecording: Dispatch<SetStateAction<boolean>>;
  isTranscriptionProcessing: boolean;
  setIsTranscriptionProcessing: Dispatch<SetStateAction<boolean>>;
  annotationToExplanationMap: { [key: string]: string } | null;
  setAnnotationToExplanationMap: Dispatch<SetStateAction<{ [key: string]: string } | null>>;
  annotationHistory: any[][];
  boardShapes: any[][];
  setBoardShapes: Dispatch<SetStateAction<any[][]>>;
  setAnnotationHistory: Dispatch<SetStateAction<any[][]>>;
  tldrawEditor: Editor | null;
  setTldrawEditor: Dispatch<SetStateAction<Editor | null>>;
  systemInteractionLog: SystemInteractionLog;
  setSystemInteractionLog: Dispatch<SetStateAction<SystemInteractionLog>>;
  messageHistory: OpenAiMessage[][];
  setMessageHistory: Dispatch<SetStateAction<OpenAiMessage[][]>>;
}

export const InterfaceContext = createContext<InterfaceContextType>({
  currentQuestion: 0,
  setCurrentQuestion: () => { },
  llmResponse: '',
  setLlmResponse: () => { },
  userQuestion: '',
  setUserQuestion: () => { },
  isRecording: false,
  setIsRecording: () => { },
  isTranscriptionProcessing: false,
  setIsTranscriptionProcessing: () => { },
  annotationToExplanationMap: null,
  setAnnotationToExplanationMap: () => { },
  annotationHistory: [],
  setAnnotationHistory: () => { },
  boardShapes: [[], [], []],
  setBoardShapes: () => { },
  tldrawEditor: null,
  setTldrawEditor: () => { },
  systemInteractionLog: {
    question0VoiceRecords: 0,
    question1VoiceRecords: 0,
    question2VoiceRecords: 0,
    question0Reads: 0,
    question1Reads: 0,
    question2Reads: 0,
    q0Messages: [],
    q1Messages: [],
    q2Messages: [],
  },
  setSystemInteractionLog: () => { },
  messageHistory: [[], [], []],
  setMessageHistory: () => { },
});

export interface MessageObject {
  id: string;
  timestamp: Date;
  role: 'assistant' | 'user';
  content: string;
  imageUrl?: string;
  annotations?: AnnotationObject[];
}

export interface SystemInteractionLog {
  question0VoiceRecords: number;
  question1VoiceRecords: number;
  question2VoiceRecords: number;
  question0Reads: number;
  question1Reads: number;
  question2Reads: number;
  q0Messages: MessageObject[];
  q1Messages: MessageObject[];
  q2Messages: MessageObject[];
}

export type OpenAiMessage = {
  role: 'assistant' | 'user';
  content: string;
  imageUrls?: string[];
}

DefaultSizeStyle.setDefaultValue('s')

export default function Interface() {
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [llmResponse, setLlmResponse] = useState<string>('');
  const [userQuestion, setUserQuestion] = useState<string>('');
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isTranscriptionProcessing, setIsTranscriptionProcessing] = useState<boolean>(false);
  const [annotationToExplanationMap, setAnnotationToExplanationMap] = useState<{ [key: string]: string } | null>({});
  const [annotationHistory, setAnnotationHistory] = useState<any[][]>([]);
  const [boardShapes, setBoardShapes] = useState<any[][]>([[], [], []]);
  const [messageHistory, setMessageHistory] = useState<OpenAiMessage[][]>([[], [], []]);
  const [tldrawEditor, setTldrawEditor] = useState<Editor | null>(null);

  // system interaction log
  const [systemInteractionLog, setSystemInteractionLog] = useState<SystemInteractionLog>({
    question0VoiceRecords: 0,
    question1VoiceRecords: 0,
    question2VoiceRecords: 0,
    question0Reads: 0,
    question1Reads: 0,
    question2Reads: 0,
    q0Messages: [],
    q1Messages: [],
    q2Messages: [],
  });

  const components: TLComponents = {
    TopPanel: DeleteAnnotationsPanel,
    SharePanel: WhiteboardState,
    InFrontOfTheCanvas: ContextToolbarComponent,
    StylePanel: null,
  };

  // useEffect(() => {
  //   if (tldrawEditor) {
  //     const selectedHistoryShapes = annotationHistory[currentHistoryIndex];
  //     const currentAnnotatedShapes = tldrawEditor.getCurrentPageShapes().filter(shape => shape.id.startsWith('shape:annotated'));

  //     // delete all currentAnnotatedShapes
  //     currentAnnotatedShapes.forEach(shape => tldrawEditor.deleteShape(shape.id));

  //     // place selectedHistoryShapes
  //     selectedHistoryShapes.forEach(shape => {
  //       tldrawEditor.createShape(shape);
  //     });
  //   }
  // }, [currentHistoryIndex]);

  useEffect(() => {
    const updateFirebaseDoc = async () => {
      const userId = localStorage.getItem("userId");
      const docRef = doc(firestoreDb, "participants", userId!);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          ...docSnap.data(),
          ...{
            systemInteractionLog: systemInteractionLog,
          },
        });
      } else {
        console.error("Document does not exist!");
      }
    }

    updateFirebaseDoc();
  }, [systemInteractionLog]);

  useEffect(() => {
    setLlmResponse('');
    setUserQuestion('');
  }, [currentQuestion]);

  return (
    <InterfaceContext.Provider value={{ currentQuestion, setCurrentQuestion, llmResponse, setLlmResponse, userQuestion, setUserQuestion, isRecording, setIsRecording, isTranscriptionProcessing, setIsTranscriptionProcessing, annotationToExplanationMap, setAnnotationToExplanationMap, annotationHistory, setAnnotationHistory, boardShapes, setBoardShapes, tldrawEditor, setTldrawEditor, systemInteractionLog, setSystemInteractionLog, messageHistory, setMessageHistory }}>
      <div className={`${inter.className} h-dvh w-full flex flex-col items-center p-2 overflow-hidden gap-2`}>
        <ResizablePanelGroup
          direction="horizontal"
          className="rounded-lg border md:min-w-full"
        >
          <ResizablePanel defaultSize={27} maxSize={27} minSize={20} className="flex flex-col gap-4">
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={50} minSize={45} className="p-4 flex flex-col gap-4">
                {currentQuestion === 0 ?
                  <Card className="w-full flex-wrap">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 m-0">
                      <CardTitle className="font-bold text-xl">Practice Mode</CardTitle>
                      <div style={{ marginTop: 0 }}>
                        <Button variant="default" onClick={() => setCurrentQuestion(1)}>
                          Continue
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                  :
                  <Card className="w-full flex-wrap">
                    <CardHeader className="flex flex-row items-center justify-between gap-4 m-0">
                      <CardTitle className="font-bold text-xl">Question</CardTitle>
                      <div className="flex gap-2 items-center" style={{ marginTop: 0 }}>
                        <Button variant={currentQuestion === 1 ? 'default' : 'secondary'} onClick={() => {
                          setCurrentQuestion(1)
                        }}>
                          Q1
                        </Button>
                        <Button variant={currentQuestion === 2 ? 'default' : 'secondary'} onClick={() => {
                          setCurrentQuestion(2)
                        }}>
                          Q2
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                }
                <HelperCard />
              </ResizablePanel>
              <ResizableHandle withHandle className="w-full" />
              <ResizablePanel defaultSize={50} minSize={45} className="p-4 flex flex-col gap-4">
                <Card className="w-full h-full flex-wrap overflow-y-auto">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="font-bold text-xl">AI Response</CardTitle>
                    <TextToSpeechButton />
                  </CardHeader>
                  <CardContent className="text-sm">
                    {llmResponse === '' ?
                      <p className="text-sm">Ask a question to get a response here. Click on the annotations for more detailed explanations.</p> :
                      <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} className="whitespace-pre-line">
                        {preprocessLaTeX(llmResponse)}
                      </Markdown>
                    }
                  </CardContent>
                </Card>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={73} maxSize={80} className="p-4">
            <div className="h-full w-full">
              <Tldraw components={components} shapeUtils={scribbleShape} onMount={(editor) => setTldrawEditor(editor)}>
              </Tldraw>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </InterfaceContext.Provider>
  );
}