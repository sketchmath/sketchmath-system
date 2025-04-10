import { questionsBaseline, solutionsBaseline } from "@/utils/questions";
import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";

// Define response data type
type ResponseData = {
  message: string;
};

// Define error response type
type ErrorResponse = {
  error: string;
};

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData | ErrorResponse>
) {
  // Only allow POST method
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Extract messages and images from request body
    const { questionNumber, messages, images } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res
        .status(400)
        .json({ error: "Invalid request: messages array is required" });
    }

    // Prepare the OpenAI request
    // If images are provided, format them for the API
    const openaiMessages = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: "You are an expert math tutor helping the user solve a math problem. Give step-by-step guidance, do not provide the full solution.",
          },
          {
            type: "text",
            text: `
            The math problem: ${questionsBaseline[`q${questionNumber}`]}\n
            The full solution for the math problem: ${
              solutionsBaseline[`q${questionNumber}`]
            } 
            `,
          },
        ],
      },
      ...messages,
    ];

    // Add image URLs to the last user message if available
    if (images && images.length > 0) {
      // Find the last user message to attach images to
      const lastUserMessageIndex = openaiMessages
        .map((msg, i) => (msg.role === "user" ? i : -1))
        .filter((i) => i !== -1)
        .pop();

      if (lastUserMessageIndex !== undefined) {
        // Convert the content to the format expected by OpenAI for images
        const content = Array.isArray(
          openaiMessages[lastUserMessageIndex].content
        )
          ? openaiMessages[lastUserMessageIndex].content
          : [
              {
                type: "text",
                text: openaiMessages[lastUserMessageIndex].content,
              },
            ];

        // Add image URLs
        images.forEach((imageUrl: string) => {
          content.push({
            type: "image_url",
            image_url: { url: imageUrl },
          });
        });

        openaiMessages[lastUserMessageIndex].content = content;
      }
    }

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: openaiMessages,
    });

    // Extract the assistant's message from the response
    const assistantMessage = completion.choices[0]?.message?.content || "";

    // Return the assistant's message
    return res.status(200).json({ message: assistantMessage });
  } catch (error: any) {
    console.error("Error processing chat request:", error);
    return res
      .status(500)
      .json({ error: error.message || "Failed to process request" });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};
