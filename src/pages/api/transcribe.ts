import fs from "fs";
import OpenAI from "openai";
import { NextApiRequest, NextApiResponse } from "next";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const base64Audio = req.body.audio;
  if (!base64Audio) {
    return res.status(400).json({ error: "No audio data provided" });
  }

  const audio = Buffer.from(base64Audio, "base64");
  const filePath = `/tmp/input-${Date.now()}.wav`;

  try {
    fs.writeFileSync(filePath, audio);
    const readStream = fs.createReadStream(filePath);

    const transcription = await openai.audio.transcriptions.create({
      file: readStream,
      model: "whisper-1",
      language: "en",
      response_format: "json",
    });

    // Clean up the temporary file
    fs.unlinkSync(filePath);

    return res.status(200).json({ text: transcription.text });
  } catch (error) {
    console.error("Error processing audio:", error);

    // Clean up the temporary file in case of error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.status(500).json({
      error: "Error processing audio",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
