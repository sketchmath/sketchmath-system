import { EquationWithTermsType } from "@/components/HelperCard";
import { OpenAiMessage } from "@/pages/interface";
import { questions, solutions } from "@/utils/questions";
import { clsx, type ClassValue } from "clsx";
import { customAlphabet } from "nanoid";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function preprocessLaTeX(content: string) {
  // Replace block-level LaTeX delimiters \[ \] with $$ $$

  const blockProcessedContent = content.replace(
    /\\\[(.*?)\\\]/gs,
    (_, equation) => `$$${equation}$$`
  );
  // Replace inline LaTeX delimiters \( \) with $ $
  const inlineProcessedContent = blockProcessedContent.replace(
    /\\\((.*?)\\\)/gs,
    (_, equation) => `$${equation}$`
  );
  return inlineProcessedContent;
}

type Point = {
  x: number;
  y: number;
  z: number;
};

export function calculateCentroidAndBoundingBox(stroke: any) {
  const xOrigin = stroke.x;
  const yOrigin = stroke.y;

  const points = stroke.props.segments.flatMap(
    (segment: any) => segment.points
  );

  if (points.length === 0) {
    throw new Error("No points found in stroke.");
  }

  // Compute absolute coordinates
  const absolutePoints = points.map((p: Point) => ({
    x: xOrigin + p.x,
    y: yOrigin + p.y,
  }));

  // Compute centroid
  const sumX = absolutePoints.reduce((sum: number, p: Point) => sum + p.x, 0);
  const sumY = absolutePoints.reduce((sum: number, p: Point) => sum + p.y, 0);
  const centroid = {
    x: sumX / absolutePoints.length,
    y: sumY / absolutePoints.length,
  };

  // Compute bounding box
  const minX = Math.min(...absolutePoints.map((p: Point) => p.x));
  const maxX = Math.max(...absolutePoints.map((p: Point) => p.x));
  const minY = Math.min(...absolutePoints.map((p: Point) => p.y));
  const maxY = Math.max(...absolutePoints.map((p: Point) => p.y));

  const boundingBox = {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };

  return { centroid, boundingBox };
}

export function generateNewCorrectionPrompt(
  eqsData: EquationWithTermsType[],
  whiteboardImage: string
) {
  const userContent: any[] = [];

  userContent.push({
    type: "text",
    text: `
    **Task: Correct Term Representations in Equations**  
    - The provided **JSON object** contains equations with their **LaTeX representation** (accurate) and **terms** (text values may be inaccurate).  
    - Your task is to **correct the text representation of each term**, ensuring it accurately reflects its **LaTeX equivalent**.  

    **Input JSON Object:**  
    - **Equations:** Extracted from the **whiteboard image**, with correct LaTeX representations.  
    - **Terms:** Each equation consists of multiple terms, but their **text values may be incorrect**.  

    \`\`\`json
    ${JSON.stringify(eqsData)}
    \`\`\`  

    **Example of Term Correction:**  
    - **Incorrect Representation:** The term **x²** might be written as **x2** in text.  
    - **Correction:** Convert the text representation into its correct **LaTeX string** form.  

    **Guidelines for Term Correction:**  
    - Use the **whiteboard image** and the **LaTeX representation** of equations to ensure accuracy.  
    - If the number of term objects in an equation is **insufficient**, logically **combine terms** to maintain equation integrity.  
    - **Ignore** all non-equation annotations (e.g., circles, curves, rectangles, crossed-out lines, arrows).  

    **Expected Output Format:**  
    Return a **JSON object** containing the corrected **LaTeX representation** for each term:  

    \`\`\`json
    {
      "correctedTerms": [
        {
          "id": "string",  // Term ID (must match the provided ID)
          "latex": "string" // Corrected LaTeX representation of the term
        }
      ]
    }
    \`\`\`  
    `,
  });

  userContent.push({
    type: "image_url",
    image_url: {
      url: `data:image/jpeg;base64,${whiteboardImage}`,
    },
  });

  const messages: any[] = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: `
          **Role:** You are an expert in LaTeX-based equation processing.  
          **Task:** Use the **image** and **LaTeX representations of equations** to accurately convert each term's text representation into a **LaTeX string**.  
          `,
        },
      ],
    },
    {
      role: "user",
      content: userContent,
    },
  ];

  return messages;
}

export function generateAnalyzePrompt(
  eqData: EquationWithTermsType[],
  whiteboardImage: string,
  questionNumber: number,
  userQuestion: string,
  messageHistory: OpenAiMessage[][]
) {
  const questionNumberString = `q${questionNumber}`;
  const currentQuestionMessageHistory = messageHistory[questionNumber];

  const messages: any = [
    {
      role: "system",
      content: [
        {
          type: "text",
          text: `
          **Role and Task Definition**  
          - You are an expert math tutor specializing in calculus.
          - Your objective is to give step-by-step guidance to help a student solve a calculus problem.
          - You have access to:
            - A whiteboard image containing the student's handwritten work and annotations.
            - A JSON object that represents the extracted words, equations, and terms from the whiteboard.

          **Context and Background**
          - **Calculus Problem Statement:** The problem is provided as ${
            questions[questionNumberString]
          }.  
          - **Solution Provided:** The full solution is given as ${
            solutions[questionNumberString]
          }.  
          - **Student Question:** The student has asked: ${userQuestion}.  
          - **Whiteboard Image:** Displays the problem statement, student's handwritten work, and annotations.
          - **Extracted Data:** A structured JSON object containing words, equations, and individual terms, including their bounding box coordinates.
          - **Interpreting Annotations on the Whiteboard Image (Table 1):**  
          | Annotation                     | Meaning                                                       |
          |--------------------------------|---------------------------------------------------------------|
          | Circle                         | The student is focusing on this part while asking a question. |
          | Curves                         | Indicates space management.                                   |
          | Rectangle                      | Visualizing the problem or boxing the final answer.           |
          | Mathematical Expressions       | Intermediate calculations for solving the problem.            |
          | Crossed out / straight lines   | Simplifications, key details, or eliminations.                |
          | Scribbled-out lines            | Indicates a correction or mistake.                            |
          | Text                           | Off-task notes or next-step transitions.                      |
          | Arrow                          | Shows reasoning flow, substitution, or next-step transitions. |

          **Instructions for Two Types of Feedback**  

          1. **Direct Response to the Student's Question:**  
            - Provide a concise answer (2-3 sentences) that addresses the student's question.  
            - If no question is asked, provide general feedback on the whiteboard work.
            - Connect your response to the handwritten work on the whiteboard, explaining relevant parts without revealing the complete solution.  
            - Include formulas when asked.
            - Use LaTeX formatting for any mathematical expressions.

          2. **Annotations on the Handwritten Solution:**  
            - Analyze the provided JSON object (denoted as ${JSON.stringify(
              eqData
            )}) which contains words, equations, and their respective terms.  
            - Annotate only the incorrect or unclear parts:  
              - For each annotation, refer to the corresponding item's id (for words or equations) or termId (for specific parts within an equation).  
              - Use **red** for corrections or errors, and **blue** for general guidance.  
              - Each item and term may have at most one annotation.  
            - Provide a one-sentence explanation for each annotation that answers the student's question.
            - If no question is asked, provide general feedback on the whiteboard work.
            - Include formulas when asked.
            - Use LaTeX formatting for any mathematical expressions.

          **Desired Output Format**  
          Return your answer in the following JSON format:

          \`\`\`json
          {
            "ovFb": "string",  // The first type of feedback: Direct Response to the Student's Question (refer above)
            "annos": [         // The second type of feedback: Annotations on the Handwritten Solution (refer above)
              {
                "eqsToAnno": [
                  {
                    "eqId": "string",          // ID of the equation or word
                    "annoExp": "explanation",  // Brief explanation in plain text
                    "annoColor": "blue"        // Use 'blue' for clarifications, 'red' for corrections
                  }
                ],
                "termsToAnno": [
                  {
                    "termId": "string",        // ID of the specific term within an equation
                    "annoExp": "explanation",  // Brief explanation in plain text
                    "annoColor": "blue"        // Use 'blue' for clarifications, 'red' for corrections
                  }
                ]
              }
            ]
          }
          \`\`\`

          **Additional Guidelines:**  
          - Be clear and specific in your instructions and explanations.  
          - Provide context by linking your response and annotations directly to both the student's question and the handwritten work.  
          - Keep your feedback concise and focused.  
          - If no solution is provided in any area, annotate only the key English words from the problem that could help guide the student.

          **Example for Annotation:**  
          - If the student highlights an error in an equation term (e.g., a miscalculation in the derivative), annotate the term's ID with a brief explanation such as “Review the derivative rule for this term” using a red color if it's incorrect.
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
            url: `data:image/jpeg;base64,${whiteboardImage}`,
          },
        },
      ],
    },
    ...currentQuestionMessageHistory,
  ];

  return messages;
}

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MathpixResponse = {
  success: boolean;
  equations?: {
    id: string;
    latex: string;
    boundingBox: BoundingBox;
  }[];
  error?: string;
};

function getBoundingBox(cnt: [number, number][]): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  // Extract x and y coordinates, ensuring no negative values
  const xCoords = cnt.map((point) => Math.max(0, point[0]));
  const yCoords = cnt.map((point) => Math.max(0, point[1]));

  // Compute bounding box
  const minX = Math.min(...xCoords);
  const maxX = Math.max(...xCoords);
  const minY = Math.min(...yCoords);
  const maxY = Math.max(...yCoords);

  const width = maxX - minX;
  const height = maxY - minY;

  return { x: minX, y: minY, width, height } as BoundingBox;
}

export const processImage = async (
  imageData: string
): Promise<MathpixResponse> => {
  let base64Image = imageData;

  // Remove data URI prefix if present
  if (base64Image.startsWith("data:image")) {
    base64Image = base64Image.split(",")[1];
  }

  try {
    const response = await fetch("https://api.mathpix.com/v3/text", {
      method: "POST",
      headers: {
        app_id: process.env.NEXT_PUBLIC_MATHPIX_APP_ID || "",
        app_key: process.env.MATHPIX_APP_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        src: `data:image/jpeg;base64,${base64Image}`,
        include_word_data: true,
      }),
    });

    const mathpixData = await response.json();

    const data: any[] = mathpixData.word_data;

    const nanoid = customAlphabet(
      "1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
      8
    );

    const res = data.map((item: any) => {
      return {
        id: `item-${nanoid(8)}`,
        latex: item.text,
        boundingBox: getBoundingBox(item.cnt),
      };
    });

    return {
      success: true,
      equations: res,
    };
  } catch (error) {
    console.error("Error processing image with Mathpix:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process image",
    };
  }
};

export function calculateOverlapPercentage(
  box1: BoundingBox,
  box2: BoundingBox
): number {
  // Calculate the coordinates of the bottom right corners
  const box1Right = box1.x + box1.width;
  const box1Bottom = box1.y + box1.height;
  const box2Right = box2.x + box2.width;
  const box2Bottom = box2.y + box2.height;

  // Calculate the overlap dimensions
  const overlapWidth = Math.max(
    0,
    Math.min(box1Right, box2Right) - Math.max(box1.x, box2.x)
  );
  const overlapHeight = Math.max(
    0,
    Math.min(box1Bottom, box2Bottom) - Math.max(box1.y, box2.y)
  );

  // Calculate the overlap area
  const overlapArea = overlapWidth * overlapHeight;

  // Calculate the areas of both boxes
  const box1Area = box1.width * box1.height;
  const box2Area = box2.width * box2.height;

  // Calculate the percentage of overlap relative to the smaller box
  // This ensures the percentage is between 0 and 100
  const smallerBoxArea = Math.min(box1Area, box2Area);

  // Avoid division by zero
  if (smallerBoxArea === 0) {
    return 0;
  }

  // Return the percentage of overlap
  return (overlapArea / smallerBoxArea) * 100;
}

export const compressBase64Image = (
  base64Image: string,
  maxDimension: number = 1024,
  quality: number = 0.9
): Promise<string> => {
  // Make sure we're on the client side
  if (typeof window === "undefined") {
    return Promise.reject(
      new Error("This function can only be used on the client side")
    );
  }

  return new Promise((resolve, reject) => {
    // Create an image object to load the base64 data
    const img = new Image();
    img.crossOrigin = "Anonymous";

    // Handle loading errors
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };

    // Process the image once loaded
    img.onload = () => {
      // Calculate new dimensions while preserving the original aspect ratio
      const originalWidth = img.width;
      const originalHeight = img.height;
      const aspectRatio = originalWidth / originalHeight;

      let width, height;

      // Skip resizing if both dimensions are already smaller than maxDimension
      if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
        width = originalWidth;
        height = originalHeight;
      }
      // Scale based on the larger dimension while maintaining aspect ratio
      else if (originalWidth > originalHeight) {
        width = Math.min(originalWidth, maxDimension);
        height = width / aspectRatio;
      } else {
        height = Math.min(originalHeight, maxDimension);
        width = height * aspectRatio;
      }

      // Round dimensions to prevent blurry images
      width = Math.round(width);
      height = Math.round(height);

      // Create a canvas element to draw and compress the image
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      // Draw the image on the canvas
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Get the compressed image as base64
      try {
        // Convert to JPEG with specified quality
        const compressedBase64 = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedBase64);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    // Set the source of the image object to the provided base64 string
    img.src = base64Image;
  });
};
