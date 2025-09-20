// evaluation.schema.js

import { z } from "zod";

// The main schema for the entire evaluation result from the AI.
// All visual annotation fields have been removed.
export const EvaluationResultSchema = z.object({
  marksA: z.number().min(0).max(1).describe("Marks awarded for part A (Knowledge)."),
  marksB: z.number().min(0).max(2).describe("Marks awarded for part B (Understanding)."),
  marksC: z.number().min(0).max(3).describe("Marks awarded for part C (Application)."),
  marksD: z.number().min(0).max(4).describe("Marks awarded for part D (Higher-Order)."),
  feedbackA: z.string().describe("Detailed feedback for the student's answer to part A."),
  feedbackB: z.string().describe("Detailed feedback for the student's answer to part B."),
  feedbackC: z.string().describe("Detailed feedback for the student's answer to part C."),
  feedbackD: z.string().describe("Detailed feedback for the student's answer to part D."),
  handWriting: z.enum(['Excellent', 'Good', 'Average', 'Poor']).describe("An assessment of the student's handwriting clarity."),
  overallFeedback: z.string().describe("A concise, overall summary of the student's performance on this question."),
});