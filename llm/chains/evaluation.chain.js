import { z } from "zod";
import { StructuredOutputParser } from "langchain/output_parsers";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import { evaluatorLLM } from "./evaluatorLLM"; // Your provided LLM wrapper

// Define the main Zod schema for the entire evaluation output
// All visual annotation fields have been removed.
export const evaluationSchema = z.object({
  marksA: z.number().min(0).max(1).describe("Marks for part A (Knowledge)."),
  marksB: z.number().min(0).max(2).describe("Marks for part B (Understanding)."),
  marksC: z.number().min(0).max(3).describe("Marks for part C (Application)."),
  marksD: z.number().min(0).max(4).describe("Marks for part D (Higher-Order)."),
  feedbackA: z.string().describe("Detailed feedback for the student's answer to part A."),
  feedbackB: z.string().describe("Detailed feedback for the student's answer to part B."),
  feedbackC: z.string().describe("Detailed feedback for the student's answer to part C."),
  feedbackD: z.string().describe("Detailed feedback for the student's answer to part D."),
  handWriting: z.enum(['Excellent', 'Good', 'Average', 'Poor']).describe("An assessment of the student's handwriting clarity."),
  evaluationConfidence: z.number().min(0).max(1).describe("The AI's confidence in its evaluation, from 0.0 to 1.0."),
});

// Create a parser that will use the Zod schema to format instructions and parse the output
const parser = StructuredOutputParser.fromZodSchema(evaluationSchema);

// Create the prompt template
const prompt = new ChatPromptTemplate({
  promptMessages: [
    SystemMessagePromptTemplate.fromTemplate(
      `You are a highly intelligent and fair AI exam evaluator for the Bangladeshi SSC/HSC curriculum. Your task is to evaluate a student's handwritten answer for a single Creative Question based on the provided model answer and marking rules.

      **Core Task & Rules:**
      1.  Read the student's handwritten answer from the provided images.
      2.  Compare the student's answer for each part (A, B, C, D) against the provided model answer.
      3.  **Marking Rule - Partial Credit:** Award partial marks if the student's approach, formula, or concept is partially correct, even if the final calculation is wrong. A mark of 0 should only be given for a completely incorrect or unattempted answer.
      4.  Provide detailed, constructive textual feedback for each question part, explaining the reasoning for the awarded marks.
      5.  Assess the clarity of the student's handwriting.
      
      You MUST respond ONLY with a JSON object that strictly adheres to the following format instructions:
      {format_instructions}`
    ),
    HumanMessagePromptTemplate.fromTemplate(
      `**Creative Question Details:**
      Stem: {stem}
      A: {questionA} (Correct Answer: {answerA})
      B: {questionB} (Correct Answer: {answerB})
      C: {questionC} (Correct Answer: {answerC})
      D: {questionD} (Correct Answer: {answerD})
      
      **Student's Answer Images are provided.** Please begin your evaluation.`
    ),
  ],
  inputVariables: ["stem", "questionA", "answerA", "questionB", "answerB", "questionC", "answerC", "questionD", "answerD"],
  partialVariables: { format_instructions: parser.getFormatInstructions() },
});

// The final, callable pipeline
export const evaluationChain = prompt.pipe(evaluatorLLM).pipe(parser);