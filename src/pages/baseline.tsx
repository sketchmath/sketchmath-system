import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MicIcon, ImageIcon, SendIcon, XIcon, Loader2, SquareIcon } from "lucide-react";
import { compressBase64Image, preprocessLaTeX } from "@/lib/utils";
import Markdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import 'katex/dist/katex.min.css';
import { useRecordVoice } from "@/hooks/useRecordVoice";
import { questionsBaseline } from "@/utils/questions";
import { updateDoc, doc, getDoc } from 'firebase/firestore';
import firestoreDb from '@/utils/firestore';
import firebaseStorage from "@/utils/firebaseStorage";
import { getDownloadURL, ref, uploadString } from "firebase/storage";

type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  imageUrls?: string[];
};

interface BaselineInteractionLog {
  recordQuestion0Clicks: number;
  recordQuestion1Clicks: number;
  recordQuestion2Clicks: number;
  imagesUploadedQuestion0: number;
  imagesUploadedQuestion1: number;
  imagesUploadedQuestion2: number;
  q0Messages: Message[];
  q1Messages: Message[];
  q2Messages: Message[];
}

export default function BaselineChatInterface() {
  const [messages, setMessages] = useState<Message[][]>([[], [], []]);
  const [currentQuestion, setCurrentQuestion] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { recording, processing, startRecording, stopRecording, text } = useRecordVoice();

  const [baselineInteractionLog, setBaselineInteractionLog] = useState<BaselineInteractionLog>({
    recordQuestion0Clicks: 0,
    recordQuestion1Clicks: 0,
    recordQuestion2Clicks: 0,
    imagesUploadedQuestion0: 0,
    imagesUploadedQuestion1: 0,
    imagesUploadedQuestion2: 0,
    q0Messages: [],
    q1Messages: [],
    q2Messages: [],
  });

  useEffect(() => {
    const updateFirebaseDoc = async () => {
      const userId = localStorage.getItem("userId");
      const docRef = doc(firestoreDb, "participants", userId!);
      const docSnap = await getDoc(docRef);

      // make a copy of messages
      const baselineInteractionLogCopy = JSON.parse(JSON.stringify(baselineInteractionLog));

      if (docSnap.exists()) {
        await updateDoc(docRef, {
          ...docSnap.data(),
          baselineInteractionLog: baselineInteractionLogCopy,
        });
      } else {
        console.error("Document does not exist!");
      }
    }

    updateFirebaseDoc();
  }, [baselineInteractionLog]);

  useEffect(() => {
    setBaselineInteractionLog((prev) => ({
      ...prev,
      q0Messages: messages[0],
      q1Messages: messages[1],
      q2Messages: messages[2],
    }));
  }, [messages]);

  const toggleRecording = () => {
    if (recording) {
      stopRecording();
    } else {
      setBaselineInteractionLog((prev) => ({
        ...prev,
        [`recordQuestion${currentQuestion}Clicks`]: prev[`recordQuestion${currentQuestion}Clicks` as keyof BaselineInteractionLog] as number + 1
      }));

      startRecording()
    };
  };

  useEffect(() => {
    if (recording) {
      setInput("Recording...");
    } else if (processing) {
      setInput("Processing...");
    } else {
      setInput(text);
    }
  }, [recording, processing, text]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setImagePreviews(prev => [...prev, result]);
        };
        reader.readAsDataURL(file);
      });

      // Reset file input so the same file can be selected again
      e.target.value = '';
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const removeImage = (index: number) => {
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const sendMessage = async () => {
    if (!input.trim() && imagePreviews.length === 0) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: "user",
      timestamp: new Date(),
      imageUrls: imagePreviews.length > 0 ? [...imagePreviews] : [],
    };

    const userId = localStorage.getItem("userId");
    if (newMessage.imageUrls?.length) {
      const storageImageUrls: string[] = [];
      for (let i = 0; i < newMessage.imageUrls.length; i++) {
        const imageUrl = newMessage.imageUrls[i];
        const imagePath = `users/${userId}/baseline/q0/${newMessage.id}_image_${i}`;
        const imageRef = ref(firebaseStorage, imagePath);
        if (imageUrl && imageUrl.includes(',')) {
          // compress base64 image
          const compressedImageUrl = await compressBase64Image(imageUrl);
          const base64Data = compressedImageUrl.split(',')[1];
          if (base64Data) {
            try {
              // Wait for upload to complete
              await uploadString(imageRef, `data:text/plain;base64,${base64Data}`, 'data_url', {
                contentType: "image/jpg",
              });
              // Only get URL after upload is complete
              const url = await getDownloadURL(imageRef);
              storageImageUrls.push(url);
            } catch (error) {
              console.error('Error uploading image:', error);
            }
          }
        }
      }
      newMessage.imageUrls = storageImageUrls;
    }

    // Update messages for the current question
    setMessages(prevMessages => {
      const newMessages = [...prevMessages];
      if (!newMessages[currentQuestion]) {
        newMessages[currentQuestion] = [];
      }
      newMessages[currentQuestion].push(newMessage);
      return newMessages;
    });
    setInput("");
    setImagePreviews([]);
    setIsLoading(true);

    // Prepare messages for API
    const apiMessages = messages[currentQuestion].concat(newMessage).map(msg => ({
      role: msg.role,
      content: msg.content,
      imageUrls: msg.imageUrls // Include image URLs in the API request
    }));

    try {
      setBaselineInteractionLog((prev) => ({
        ...prev,
        [`imagesUploadedQuestion${currentQuestion}`]: prev[`imagesUploadedQuestion${currentQuestion}` as keyof BaselineInteractionLog] as number + (newMessage.imageUrls?.length || 0)
      }));

      // Call API endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionNumber: currentQuestion,
          messages: apiMessages,
          images: newMessage.imageUrls || [] // Explicitly send the images from this message
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();

      // Add AI response to messages
      const aiMessage: Message = {
        id: Date.now().toString(),
        content: data.message,
        role: "assistant",
        timestamp: new Date(),
        imageUrls: data.imageUrls || [] // Handle any images the API might return
      };

      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (!newMessages[currentQuestion]) {
          newMessages[currentQuestion] = [];
        }
        newMessages[currentQuestion].push(aiMessage);
        return newMessages;
      });
    } catch (error) {
      console.error('Failed to send message:', error);

      // Show error in chat or as notification
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: "Sorry, there was an error processing your request.",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (!newMessages[currentQuestion]) {
          newMessages[currentQuestion] = [];
        }
        newMessages[currentQuestion].push(errorMessage);
        return newMessages;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-dvh bg-white p-4">
      <Card className="w-full h-full flex flex-col">
        <CardHeader className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">Chat</CardTitle>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-xl mr-2">{currentQuestion === 0 ? 'Practice Mode' : 'Question'}</h2>
              {currentQuestion === 0 ?
                <Button variant="default" onClick={() => setCurrentQuestion(1)}>
                  Continue
                </Button>
                :
                <>
                  <Button variant={currentQuestion === 1 ? "default" : "secondary"} onClick={() => {
                    setCurrentQuestion(1)
                  }}>
                    Q1
                  </Button>
                  <Button variant={currentQuestion === 2 ? "default" : "secondary"} onClick={() => {
                    setCurrentQuestion(2)
                  }}>
                    Q2
                  </Button>
                </>
              }
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-semibold text-lg">{currentQuestion === 0 ? 'Practice Question' : `Question ${currentQuestion}:`}</h2>
            <p>{questionsBaseline[`q${currentQuestion}`]}</p>
          </div>
        </CardHeader>

        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages[currentQuestion] && messages[currentQuestion].length === 0 ? (
              <div className="flex items-center justify-center h-full absolute inset-0">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-3xl font-bold">Start by asking a question!</p>
                  <div className="text-center flex flex-col gap-1">
                    <p>Type a message in the input box below.</p>
                    <p>You can upload an image by clicking the <ImageIcon className="inline w-5 h-5" /> button.</p>
                    <p>You can also record a voice message by clicking the <MicIcon className="inline w-5 h-5" /> button.</p>
                    <p>When you are ready, click the <SendIcon className="inline w-5 h-5" /> button to send your message.</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages[currentQuestion].map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex items-start gap-2 max-w-[80%]`}>
                      <div>
                        <div className={`rounded-lg p-3 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                          }`}>
                          <Markdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]} className="whitespace-pre-line">
                            {preprocessLaTeX(message.content)}
                          </Markdown>
                          {message.imageUrls && message.imageUrls.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {message.imageUrls.map((url, index) => (
                                <img
                                  key={index}
                                  src={url}
                                  alt={`Uploaded content ${index + 1}`}
                                  className="rounded-md w-auto h-20"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        {/* <p className="text-xs text-slate-400 mt-1">
                          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p> */}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-secondary rounded-lg p-3 flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {imagePreviews.length > 0 && (
          <div className="px-4 py-2">
            <div className="flex flex-wrap gap-2">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative inline-block">
                  <img
                    src={preview}
                    alt={`Preview ${index + 1}`}
                    className="h-20 rounded-md"
                  />
                  <button
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow-sm"
                    onClick={() => removeImage(index)}
                  >
                    <XIcon className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <CardFooter className="border-t p-2">
          <div className="flex items-center w-full gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              className={`p-5 ${recording ? "text-red-500" : ""}`}
              disabled={isLoading}
            >
              {recording ? <SquareIcon size={18} /> : <MicIcon size={18} />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              onClick={triggerImageUpload}
              className="p-5"
              disabled={isLoading}
            >
              <ImageIcon size={36} />
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
                multiple
              />
            </Button>

            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 py-5"
              disabled={isLoading || processing || recording}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <Button size="icon" onClick={sendMessage} disabled={isLoading} className="p-5">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon size={36} />}
            </Button>
          </div>
        </CardFooter>
      </Card >
    </div >
  );
}