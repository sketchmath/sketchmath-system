import { InterfaceContext } from "@/pages/interface";
import { blobToBase64 } from "@/utils/blobToBase64";
import { createMediaStream } from "@/utils/createMediaStream";
import { useEffect, useState, useRef, useContext } from "react";

export const useRecordVoice = () => {
  const { setUserQuestion, setIsRecording, setIsTranscriptionProcessing } =
    useContext(InterfaceContext);
  const [text, setText] = useState("");
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null
  );
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const isRecording = useRef(false);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    setUserQuestion(text);
  }, [text, setUserQuestion]);

  useEffect(() => {
    setIsRecording(recording);
  }, [recording, setIsRecording]);

  useEffect(() => {
    setIsTranscriptionProcessing(processing);
  }, [processing, setIsTranscriptionProcessing]);

  const startRecording = () => {
    if (mediaRecorder) {
      isRecording.current = true;
      chunks.current = []; // Reset chunks before starting
      mediaRecorder.start(10); // Set a small timeslice for more frequent ondataavailable events
      setRecording(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      isRecording.current = false;
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  const getText = async (base64data: string) => {
    try {
      setProcessing(true);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audio: base64data,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setText(data.text);
    } catch (error) {
      console.error("Transcription error:", error);
    } finally {
      setProcessing(false);
    }
  };

  const initialMediaRecorder = async (stream: MediaStream) => {
    try {
      // Try to use webm on supported browsers, fallback to mp4 for iOS
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorder.onstart = () => {
        createMediaStream(stream, isRecording.current, () => {});
        chunks.current = [];
      };

      mediaRecorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          chunks.current.push(ev.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks.current, { type: mimeType });
        blobToBase64(audioBlob, getText);
      };

      setMediaRecorder(mediaRecorder);
    } catch (error) {
      console.error("Error initializing MediaRecorder:", error);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 44100,
          },
        })
        .then(initialMediaRecorder)
        .catch((error) => {
          console.error("Error accessing microphone:", error);
        });
    }

    return () => {
      if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
      }
    };
  }, []);

  return {
    recording,
    processing,
    startRecording,
    stopRecording,
    text,
    setText,
    mediaRecorder,
  };
};
