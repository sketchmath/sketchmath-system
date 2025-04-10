import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { z } from "zod";
import { generateAnalyzePrompt } from "@/lib/utils";
import { EquationWithTermsType } from "@/components/HelperCard";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AnnotationObject = z.object({
  ovFb: z.string(),
  annos: z.array(
    z.object({
      eqsToAnno: z.array(
        z.object({
          eqId: z.string(),
          annoExp: z.string(),
          annoColor: z.string(),
        })
      ),
      termsToAnno: z.array(
        z.object({
          termId: z.string(),
          annoExp: z.string(),
          annoColor: z.string(),
        })
      ),
    })
  ),
});

// get type for AnnotationObject
export type AnnotationObject = z.infer<typeof AnnotationObject>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      whiteboardImage,
      visionData,
      questionNumber,
      userQuestion,
      messageHistory,
    } = req.body;

    if (!visionData || !whiteboardImage) {
      return res
        .status(400)
        .json({ error: "Missing vision data or whiteboard image" });
    }

    // Validate base64 strings
    const base64Regex = /^data:image\/(jpeg|png);base64,/;
    if (!whiteboardImage.match(base64Regex)) {
      return res.status(400).json({ error: "Invalid base64 image format" });
    }

    const base64WhiteboardImage: string = whiteboardImage.split(",")[1];
    const eqDataObj: EquationWithTermsType[] = JSON.parse(visionData);

    const messages = generateAnalyzePrompt(
      eqDataObj,
      base64WhiteboardImage,
      questionNumber,
      userQuestion,
      messageHistory
    );

    const analyzeResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-11-20",
      messages,
      response_format: zodResponseFormat(AnnotationObject, "annotations"),
    });

    const annotations = analyzeResponse.choices[0].message.parsed!;
    const overallFeedback = analyzeResponse.choices[0].message.parsed!.ovFb;

    // console.log("Annotations:", JSON.stringify(annotations));
    // console.log("Overall feedback:", overallFeedback);

    return res.status(200).json({ overallFeedback, annotations });
  } catch (error) {
    console.error("Error processing image:", error);
    return res.status(500).json({
      error: "Error processing image. Please try again.",
    });
  }
}

// Configure API route to handle larger payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};
