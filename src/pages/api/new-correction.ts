import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { z } from "zod";
import { generateNewCorrectionPrompt } from "@/lib/utils";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { EquationWithTermsType } from "@/components/HelperCard";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CorrectedTermsObject = z.object({
  correctedTerms: z.array(
    z.object({
      id: z.string(),
      latex: z.string(),
    })
  ),
});

type CorrectedTermsObject = z.infer<typeof CorrectedTermsObject>;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { whiteboardImage, eqsData } = req.body;

    if (!eqsData || !whiteboardImage) {
      return res
        .status(400)
        .json({ error: "Missing equation data or whiteboard image" });
    }

    // Validate base64 strings
    const base64Regex = /^data:image\/(jpeg|png);base64,/;
    if (!whiteboardImage.match(base64Regex)) {
      return res.status(400).json({ error: "Invalid base64 image format" });
    }

    const eqDataObj: EquationWithTermsType[] = JSON.parse(eqsData);
    const base64WhiteboardImage: string = whiteboardImage.split(",")[1];

    const messages = generateNewCorrectionPrompt(
      eqDataObj,
      base64WhiteboardImage
    );

    const correctedResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages,
      response_format: zodResponseFormat(
        CorrectedTermsObject,
        "correctedTerms"
      ),
    });

    const correctedTermsObj: CorrectedTermsObject =
      correctedResponse.choices[0].message.parsed!;
    const correctedTerms = correctedTermsObj.correctedTerms;

    // Update original equation data with corrected terms
    for (const correctedTerm of correctedTerms) {
      const foundEq = eqDataObj.find(
        (eqData) => eqData.id === `item-${correctedTerm.id.split("-")[1]}`
      );

      // find the term in foundEq.terns and update it
      if (foundEq) {
        const foundTerm = foundEq.terms?.find(
          (term) => term.id === correctedTerm.id
        );

        if (foundTerm) {
          foundTerm.text = correctedTerm.latex;
        }
      }
    }

    return res.status(200).json({ correctedEquations: eqDataObj });
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
