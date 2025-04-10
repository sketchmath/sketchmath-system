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
      whiteboardImage,
      visionData,
      questionNumber,
      userQuestion,
      annotations,
    } = req.body;

    if (!visionData || !whiteboardImage || !annotations) {
      return res.status(400).json({
        error:
          "Missing required data: vision data, whiteboard image, or annotations",
      });
    }

    // Validate base64 strings
    const base64Regex = /^data:image\/(jpeg|png);base64,/;
    if (!whiteboardImage.match(base64Regex)) {
      return res.status(400).json({ error: "Invalid base64 image format" });
    }

    const base64WhiteboardImage: string = whiteboardImage.split(",")[1];
    const eqDataObj: EquationWithTermsType[] = JSON.parse(visionData);

    const messages: any = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: `
            **Role and Task Definition**  
            - You are an expert math tutor specializing in calculus who is verifying the quality of annotations.
            - Your objective is to review and improve the feedback and annotations provided to a student.
            - You have access to:
              - A whiteboard image containing the student's handwritten work and annotations.
              - A JSON object that represents the extracted words, equations, and terms from the whiteboard.
              - The original annotations that were generated.

            **Context and Background**
            - **Calculus Problem Statement:** The problem is provided as ${
              questions[`q${questionNumber}`]
            }.  
            - **Solution Provided:** The full solution is given as ${
              solutions[`q${questionNumber}`]
            }.  
            - **Student Question:** The student has asked: ${
              userQuestion || "No question provided"
            }.  
            - **Extracted Data:** A structured JSON object containing words, equations, and individual terms: ${JSON.stringify(
              eqDataObj
            )}
            - **Original Annotations:** The annotations to verify: ${JSON.stringify(
              annotations
            )}

            **Verification Task**
            1. **Review the overall feedback (ovFb)** for:
               - Accuracy of mathematical content
               - Relevance to student's question
               - Clarity and conciseness
               - Proper LaTeX formatting
            
            2. **Review each annotation** (both eqsToAnno and termsToAnno) for:
               - Mathematical correctness
               - Appropriateness of color selection ('blue' for guidance, 'red' for corrections)
               - Clarity of explanation
               - Relevance to solving the problem
            
            3. **Create improved annotations** that maintain the same structure but improve:
               - Mathematical accuracy
               - Clarity of explanations
               - Appropriate use of color codes
               - Relevance to the student's question

            **Output Format**  
            Return your answer in the EXACT SAME JSON format as the original:

            \`\`\`json
            {
              "ovFb": "string",  // Improved overall feedback
              "annos": [
                {
                  "eqsToAnno": [
                    {
                      "eqId": "string",          // Keep the same IDs as the original
                      "annoExp": "explanation",  // Improved explanations
                      "annoColor": "blue"        // Verified color selection
                    }
                  ],
                  "termsToAnno": [
                    {
                      "termId": "string",        // Keep the same IDs as the original
                      "annoExp": "explanation",  // Improved explanations
                      "annoColor": "blue"        // Verified color selection
                    }
                  ]
                }
              ]
            }
            \`\`\`

            **Important Guidelines:**
            - Maintain the same structure as the original annotations.
            - Keep the same sets of eqId and termId values - do not add or remove annotations.
            - Improve explanations to be more accurate, clear, and helpful.
            - Correct any color coding issues ('blue' for guidance, 'red' for corrections).
            - Ensure all mathematical notation uses proper LaTeX formatting.
            - Make sure feedback is directly relevant to the student's question.
            - Do not reveal the complete solution - focus on providing guidance.
            `,
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${base64WhiteboardImage}`,
            },
          },
        ],
      },
    ];

    const verifyResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-11-20",
      messages,
      response_format: zodResponseFormat(AnnotationObject, "annotations"),
    });

    const verifiedAnnotations = verifyResponse.choices[0].message.parsed!;
    const verifiedOverallFeedback =
      verifyResponse.choices[0].message.parsed!.ovFb;

    console.log("Verified overall feedback:", verifiedOverallFeedback);
    console.log("Verified annotations:", JSON.stringify(verifiedAnnotations));

    return res.status(200).json({
      overallFeedback: verifiedOverallFeedback,
      annotations: verifiedAnnotations,
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
