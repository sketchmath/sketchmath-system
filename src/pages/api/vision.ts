// pages/api/ocr.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import { customAlphabet } from "nanoid";

// Define response types
type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type Term = {
  id: string;
  text: string;
  boundingBox: BoundingBox;
};

type Symbol = {
  id: string;
  text: string;
  image?: string;
  boundingBox: BoundingBox;
};

export type OCRResponse = {
  success: boolean;
  allText?: string;
  equations?: {
    id: string;
    text: string;
    terms?: Term[];
    image?: string;
    boundingBox: BoundingBox;
  }[];
  error?: string;
};

const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS!);

// Initialize the Vision client
const visionClient = new ImageAnnotatorClient({
  credentials,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<OCRResponse>
) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  try {
    const { base64Image } = req.body;

    if (!base64Image) {
      return res
        .status(400)
        .json({ success: false, error: "No base64 image provided" });
    }

    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");
    const nanoid = customAlphabet(
      "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      8
    );

    const [result] = await visionClient.documentTextDetection({
      image: {
        content: imageBuffer,
      },
    });

    const visionResult = result.fullTextAnnotation;

    if (!visionResult) {
      return res.status(200).json({
        success: true,
        allText: "",
        equations: [],
      });
    }

    const allText = visionResult.text!;
    const page = visionResult.pages![0];
    const blocks = page.blocks || [];

    // Map blocks to equations
    const equations = blocks.map((block) => {
      const equationId = `item-${nanoid(8)}`;

      // Calculate equation bounding box
      const blockVertices = block.boundingBox!.vertices!;
      const x1 = blockVertices[0].x!;
      const y1 = blockVertices[0].y!;
      const x2 = blockVertices[2].x!;
      const y2 = blockVertices[2].y!;
      const width = x2 - x1;
      const height = y2 - y1;

      const equationBoundingBox: BoundingBox = {
        x: x1,
        y: y1,
        width,
        height,
      };

      // Process terms (words) in this equation (block)
      const terms: Term[] = (block.paragraphs || []).flatMap((paragraph) =>
        (paragraph.words || []).map((word) => {
          const termId = `${equationId}-term-${nanoid(6)}`;

          // Calculate term bounding box
          const wordVertices = word.boundingBox!.vertices!;
          const wx1 = wordVertices[0].x!;
          const wy1 = wordVertices[0].y!;
          const wx2 = wordVertices[2].x!;
          const wy2 = wordVertices[2].y!;
          const wwidth = wx2 - wx1;
          const wheight = wy2 - wy1;

          const termBoundingBox: BoundingBox = {
            x: wx1,
            y: wy1,
            width: wwidth,
            height: wheight,
          };

          // Process symbols in this term
          const symbols: Symbol[] = (word.symbols || []).map((symbol) => {
            const symbolVertices = symbol.boundingBox!.vertices!;
            const sx1 = symbolVertices[0].x!;
            const sy1 = symbolVertices[0].y!;
            const sx2 = symbolVertices[2].x!;
            const sy2 = symbolVertices[2].y!;
            const swidth = sx2 - sx1;
            const sheight = sy2 - sy1;

            const symbolBoundingBox: BoundingBox = {
              x: sx1,
              y: sy1,
              width: swidth,
              height: sheight,
            };

            return {
              id: `${termId}-symbol-${nanoid(6)}`,
              text: symbol.text!,
              boundingBox: symbolBoundingBox,
            };
          });

          const termText = symbols.map((s) => s.text).join("");

          return {
            id: termId,
            text: termText,
            boundingBox: termBoundingBox,
          };
        })
      );

      const equationText = terms.map((term) => term.text).join(" ");

      return {
        id: equationId,
        text: equationText,
        terms,
        boundingBox: equationBoundingBox,
      };
    });

    return res.status(200).json({
      success: true,
      allText,
      equations,
    });
  } catch (error) {
    console.error("OCR processing error:", error);
    return res.status(500).json({
      success: false,
      error: "Error processing image",
    });
  }
}
