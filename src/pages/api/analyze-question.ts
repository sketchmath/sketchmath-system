import type { NextApiRequest, NextApiResponse } from "next";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod.js";
import { z } from "zod";
import { EquationWithTermsType } from "@/components/HelperCard";
import { questions, solutions } from "@/utils/questions";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const messages: any = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: `
            ### **Role: Expert Math Tutor**  
            - You are analyzing a calculus problem.
            - You have access to **the math problem** in string format, a **whiteboard image** containing the math problem, and a **JSON object containing extracted terms (words) from the problem**.  
            - Your goal is to **provide clear guidance and targeted annotations** to help the student solve the problem efficiently.  
            `,
          },
          {
            type: "text",
            text: `
            ### **Math Problem Context:**  
            **Problem Statement:** ${questions[`q${questionNumber}`]}  
            **Full Solution (for context):** ${
              solutions[`q${questionNumber}`]
            }  
            **User's Question (if provided):** ${
              userQuestion || "No question given"
            }
            **JSON Object of Problem Statement and Extracted Terms:** ${JSON.stringify(
              eqDataObj
            )}  
            `,
          },
          {
            type: "text",
            text: `
            **Task: Provide Two Types of Feedback**  
    
            **1. Guided Feedback (ovFb Field)**  
            - If the student has asked a question (**"${userQuestion}"**), answer it concisely (2-3 sentences max).  
            - Include formulas when asked.
            - If no question is provided, **give the first step to start solving the problem**.  
            - Do **not** give the full solution—just **the best starting approach**.  
            - Use **LaTeX for any mathematical notation**.  
            - Include this response in the **"ovFb"** field of the JSON output.  
    
            **2. Annotate Key Terms Relevant to the Student's Question (termsToAnno Field)**  
            - If a **question is provided**, prioritize annotating **key terms that directly help answer it**.  
            - If **no question is given**, annotate **key terms essential to starting the problem**.
            - You have access to the **full text and bounding box of the problem**, as well as an **array of all words (terms)** with their positions in the problem.  
            - For each key term, include:  
              - The **term ID** (must match the provided ID).  
              - A **brief explanation (1 sentence)** on how to use that term to start solving the problem.  
              - **Formulas when necessary (in LaTeX)** to reinforce the concept.  
    
            **Example Annotations:**  
            **If the problem asks to find the derivative of \\( x^2 \\)**:  
            - **Term:** "derivative" → *"This means you need to differentiate the given function. Use the power rule: \\( \\frac{d}{dx} x^n = n x^{n-1} \\)."*  
            - **Term:** "x²" → *"Applying the power rule: \\( \\frac{d}{dx} x^2 = 2x \\)."*  
    
            **If the question asks about the chain rule:**  
            - **Term:** "chain rule" → *"Use the chain rule: \\( \\frac{d}{dx} f(g(x)) = f'(g(x)) \\cdot g'(x) \\)."*  
    
            **Input JSON Object (Extracted Terms)**  
            \`\`\`json
            {
              "id": "string", // question ID
              "text": "string", // LaTeX representation of the problem
              "boundingBox": {
                "x": number, "y": number, "width": number, "height": number
              },
              "terms": [
                {
                  "id": "string", // term ID
                  "text": "string", // LaTeX representation of the term
                  "boundingBox": {
                    "x": number, "y": number, "width": number, "height": number
                  }
                }
              ]
            }
            \`\`\`
    
            **Expected JSON Output Format:**  
            \`\`\`json
            {
              "ovFb": "string", // overall feedback answering the question or first step
              "termsToAnno": [
                {
                  "termId": "string", // term ID (must match input)
                  "termValue": "string", // string representation of the term
                  "termExp": "string" // explanation for annotation (LaTeX for formulas)
                }
              ]
            }
            \`\`\`  
            `,
          },
          {
            type: "text",
            text: `
            **Additional Notes:**  
            - Ignore **non-relevant annotations** (e.g., scribbles, crossed-out text, arrows).  
            - **Do not modify term IDs**—they must match the provided input.  
            - Be **precise, relevant, and focused on helping the student solve the problem**.  
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
      ...messageHistory[questionNumber],
    ];

    const analyzeResponse = await openai.beta.chat.completions.parse({
      model: "gpt-4o-2024-11-20",
      messages,
      response_format: zodResponseFormat(AnnotationObject, "annotations"),
    });

    const annotations = analyzeResponse.choices[0].message.parsed!.termsToAnno;
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
