// pages/api/process-math.ts
import { processImage } from "@/lib/utils";
import type { NextApiRequest, NextApiResponse } from "next";

// This API route handles the Mathpix API calls server-side to protect your API key
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageData } = req.body;

    if (!imageData) {
      return res.status(400).json({ error: "No image data provided" });
    }

    if (
      !process.env.NEXT_PUBLIC_MATHPIX_APP_ID ||
      !process.env.MATHPIX_APP_KEY
    ) {
      return res
        .status(500)
        .json({ error: "Mathpix API credentials not configured" });
    }

    const result = await processImage(imageData);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Error in process-math API route:", error);
    return res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to process the image",
    });
  }
}
