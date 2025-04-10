import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { z } from "zod";
import { EquationWithTermsType } from "@/components/HelperCard";
import { questions, solutions } from "@/utils/questions";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Using the same AnnotationObject schema as the original API
const AnnotationObject = z.object({
  ovFb: z.string(),
  termsToAnno: z.array(
    z.object({
      termId: z.string(),
      termValue: z.string(),
      termExp: z.string(),
    })
  ),
});

// Type for AnnotationObject
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
      questionNumber,
      userQuestion,
      annotations,
      visionData,
      whiteboardImage,
    } = req.body;

    if (!annotations || !visionData) {
      return res.status(400).json({
        error: "Missing required data: annotations, visionData",
      });
    }

    // Parse and validate base64 image if provided
    let base64WhiteboardImage = null;
    if (whiteboardImage) {
      const base64Regex = /^data:image\/(jpeg|png);base64,/;
      if (!whiteboardImage.match(base64Regex)) {
        return res.status(400).json({ error: "Invalid base64 image format" });
      }
      base64WhiteboardImage = whiteboardImage.split(",")[1];
    }

    const eqDataObj: EquationWithTermsType[] = JSON.parse(visionData);

    // Prepare messages for the verification model
    const messages: any = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: `
            ### **Role: Math Annotation Verifier and Improver**  
            
            You are an expert system designed to verify and improve the quality and accuracy of annotations for calculus problems. Your task is to analyze the given problem, the current annotations, and produce improved annotations in the same format.
            `,
          },
          {
            type: "text",
            text: `
            ### **Context:**  
            **Problem Statement:** ${questions[`q${questionNumber}`]}  
            **Expected Solution:** ${solutions[`q${questionNumber}`]}  
            **Student's Question (if provided):** ${
              userQuestion || "No question given"
            }
            **Problem Equation Data:** ${JSON.stringify(eqDataObj)}
            **Current Annotations:** ${JSON.stringify(annotations)}
            `,
          },
          {
            type: "text",
            text: `
            ### **Task:**
            
            1. **Evaluate the current annotations** for accuracy, relevance, and helpfulness
            2. For each annotation in Current Annotations, **ensure the termValue relate to termExp**. If not, create another annotation that relates the termValue to termExp and remove the original annotation.
            3. **Create improved annotations** in the exact same format
            4. **Do not** annotate article words (e.g., "the", "a", "an", "is", "if", etc.)
            5. **Ensure all mathematical content** is correctly formatted using LaTeX
            
            ### **Required Output Format:**
            Return a JSON object with the EXACT SAME structure as the input annotations.
            
            \`\`\`json
            {
              "ovFb": "string", // improved overall feedback (answer to question or first step)
              "termsToAnno": [
                {
                  "termId": "string", // must use the SAME term IDs as in the original data
                  "termValue": "string", // the term itself
                  "termExp": "string" // improved explanation with proper LaTeX
                }
              ]
            }
            \`\`\`
            
            Additionally, include an internal verification metadata object as part of your thought process:
            
            \`\`\`json
            {
              "isCorrect": boolean, // whether original annotations were generally correct
              "score": number, // score from 0-100 for original annotations
              "feedback": string, // brief assessment of why improvements were made
              "originalAnnotations": object // store the original annotations for reference
            }
            \`\`\`
            
            However, only the AnnotationObject format will be returned to the user.
            `,
          },
          {
            type: "text",
            text: `
            ### **Improvement Guidelines:**
            
            - **Fix mathematical errors** in the original annotations
            - **Enhance clarity** of explanations while keeping them concise
            - **Include proper LaTeX notation** for all mathematical formulas
            - **Only annotate terms** that exist in the original data (use the same termIds)
            - **Address the student's question directly** if one was provided
            - **Provide clearer first steps** if no question was given
            
            Remember that your improved annotations must follow the exact structure of the original annotations, but with better content.
            `,
          },
        ],
      },
    ];

    // Add image to messages if provided
    if (base64WhiteboardImage) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64WhiteboardImage}`,
            },
          },
        ],
      });
    }

    // Get improved annotations from GPT
    const verificationResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-11-20",
      messages,
      response_format: zodResponseFormat(AnnotationObject, "annotations"),
    });

    // Extract the improved annotations
    const improvedAnnotations = verificationResponse.choices[0].message.parsed!;

    // Log verification results (additional metadata could be captured via chat completion function calling)
    console.log("Improved annotations:", JSON.stringify(improvedAnnotations));

    return res.status(200).json({
      overallFeedback: improvedAnnotations.ovFb,
      annotations: improvedAnnotations,
    });
  } catch (error) {
    console.error("Error verifying annotations:", error);
    return res.status(500).json({
      error: "Error verifying annotations. Please try again.",
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
