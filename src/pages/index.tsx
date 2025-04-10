import { Button } from '@/components/ui/button';
import { inter, nanumPenScript } from '@/utils/fonts';
import Link from 'next/link';

export default function Home() {
  return (
    <div className={`${inter.className} h-dvh w-full flex items-center justify-center p-4`}>
      <div className="flex flex-col gap-4 items-center w-1/2">
        <h1 className={`${nanumPenScript.className} text-8xl`}>SketchSense</h1>
        <div className="w-[400px] flex flex-col gap-5">
          <p>
            <b>SketchSense</b> is a platform that allows users to solve calculus problems with the help of an AI agent.
          </p>
          <ol className="list-decimal pl-4">
            <li>You will be provided with a video demo of the system.</li>
            <li>You will have <b>5 minutes</b> to try out the system given a simple question.</li>
            <li>You will be given <b>two</b> calculus problems to solve on a whiteboard. <b>Please finish the first problem before moving on to the second.</b></li>
          </ol>
          <p>
            You can ask the AI agent for help using the panel on the left. When asking, you can optionally record a voice message. The AI agent can respond in voice, text, and annotations.
          </p>
        </div>
        <Button asChild size="lg" className="mt-4">
          <Link href="/participant">
            I understand, continue
          </Link>
        </Button>
      </div>
    </div >
  );
}
