import { useState, useRef, useContext, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2Icon, PauseIcon, PlayIcon } from 'lucide-react';
import { InterfaceContext, SystemInteractionLog } from '@/pages/interface';

export function TextToSpeechButton() {
  const [playClicks, setPlayClicks] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { llmResponse, setSystemInteractionLog, currentQuestion } = useContext(InterfaceContext);

  const handlePlayPause = async () => {
    if (!audioRef.current) {
      if (!llmResponse.trim()) return;

      setIsLoading(true);
      try {
        const response = await fetch('/api/text-to-speech', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text: llmResponse }),
        });

        if (!response.ok) throw new Error('Failed to generate speech');

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        audioRef.current = new Audio(audioUrl);

        audioRef.current.onended = () => {
          setIsPlaying(false);
        };

        audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error generating speech:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  useEffect(() => {
    setPlayClicks(0);
  }, [llmResponse]);

  return (
    <Button
      onClick={() => {
        if (playClicks === 0) {
          setSystemInteractionLog((prev: SystemInteractionLog) => ({
            ...prev,
            [`question${currentQuestion}Reads`]: (prev[`question${currentQuestion}Reads` as keyof SystemInteractionLog] as number || 0) + 1,
          }));
        }

        if (!isPlaying) {
          setPlayClicks((prev) => prev + 1);
        }

        handlePlayPause();
      }}
      disabled={isLoading || !llmResponse.trim()}
      variant="outline"
      size="sm"
      className="flex gap-2 items-center"
    >
      {isLoading ? (
        <>Loading</>
      ) : isPlaying ? (
        <>
          <PauseIcon size={16} />
          Pause
        </>
      ) : audioRef.current ? (
        <>
          <PlayIcon size={16} />
          Play
        </>
      ) : (
        <>
          <Volume2Icon size={16} />
          Read
        </>
      )}
    </Button>
  );
}
