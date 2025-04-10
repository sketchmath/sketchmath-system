import { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body;

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Valid text is required" });
    }

    const response = await openai.audio.speech.create({
      model: "tts-1",
      voice: "alloy",
      input: text,
    });

    // Get the audio data as an ArrayBuffer
    const audioData = await response.arrayBuffer();

    // Set the appropriate headers
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioData.byteLength);

    // Send the audio data
    res.status(200).send(Buffer.from(audioData));
  } catch (error) {
    console.error("Error generating text-to-speech:", error);
    res.status(500).json({ error: "Failed to generate speech" });
  }
}
