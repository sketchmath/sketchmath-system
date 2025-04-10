import { LoaderCircleIcon, MicIcon } from 'lucide-react';
import { useRecordVoice } from '@/hooks/useRecordVoice';
import { Button } from './ui/button';
import { useContext, useEffect } from 'react';
import { InterfaceContext, SystemInteractionLog } from '@/pages/interface';

const RecordButton = () => {
  const { setSystemInteractionLog, currentQuestion } = useContext(InterfaceContext);
  const { recording, processing, startRecording, stopRecording, setText } = useRecordVoice();

  function handleRecordClick() {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  useEffect(() => {
    if (recording) {
      setText('');
    }
  }, [recording, setText]);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <Button onClick={() => {
        if (!recording) {
          setSystemInteractionLog((prev) => ({
            ...prev,
            [`question${currentQuestion}VoiceRecords`]: (prev[`question${currentQuestion}VoiceRecords` as keyof SystemInteractionLog] as number || 0) + 1,
          }));
        }

        handleRecordClick();
      }} variant={recording ? 'destructive' : 'outline'} className="w-fit">
        {processing ?
          <>
            Processing...
            <LoaderCircleIcon className="animate-spin" />
          </>
          :
          <>
            {recording ? 'Stop' : 'Record'}
            <MicIcon />
          </>
        }
      </Button>
    </div>
  )
}

export default RecordButton;
