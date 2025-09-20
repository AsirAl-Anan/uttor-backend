// evaluation.service.js

console.log("--- EXECUTING LATEST V5 evaluation.service.js ---"); // DEBUG LINE

import { z } from "zod";
import { PromptTemplate } from "@langchain/core/prompts";
import { StructuredOutputParser } from "langchain/output_parsers";
import { StringOutputParser } from "@langchain/core/output_parsers";
import fs from "fs/promises";

// Your file imports
import { evaluatorLLM } from "../llm/geminiClient.js"; 
import CreativeQuestion from "../models/creativeQuestion.model.js";
// CqResult is the main document, AnswerEvaluation is the sub-document schema
import { CqResult, AnswerEvaluation } from "../models/cq.result.model.js";
import { EvaluationResultSchema } from "../schema/evaluation.schema.js";
import { uploadImage } from "../utils/cloudinary.js";

// =============================================================
// ==      PART 1: SINGLE QUESTION EVALUATION SETUP           ==
// =============================================================

const singleQuestionParser = StructuredOutputParser.fromZodSchema(EvaluationResultSchema);

const singleQuestionPromptTemplate = `You are a meticulous AI Exam Grader for the Bangladeshi SSC/HSC curriculum. Your task is to evaluate a student's handwritten answer for a single question based on the provided images and model answers.

**CRITICAL JSON FORMATTING RULE:**
In all feedback strings, any backslash character \`\\\` MUST be properly escaped for JSON by doubling it. For example, to write "$v\\cos\\theta$", you must write it in the JSON string as "$v\\\\cos\\\\theta$". Failure to follow this rule will result in invalid JSON.

**Core Task & Rules:**
Your evaluation must be based purely on the text and diagrams in the student's answer script.
1.  **Read and Understand:** Carefully read the student's answer for each question part (A, B, C, D) from the provided images.
2.  **Compare and Evaluate:** Compare the student's response against the provided model answer for each part.
3.  **Marking Rule - Partial Credit:** Award partial marks if the student's approach, formula, or concept is partially correct, even if the final calculation is wrong. A mark of 0 should only be given for a completely incorrect or unattempted answer.
4.  **Assign Marks:** Assign a numerical score for each part (A, B, C, D).
5.  **Provide Feedback:** For each part, write detailed, constructive textual feedback explaining why the marks were given or deducted. Refer to specific correct or incorrect parts of the student's answer.
6.  **Overall Assessment:** Provide a summary of the student's overall performance ON THIS QUESTION and assess their handwriting.

**Evaluation Details:**
- Analyze the student's answer images.
- Compare them against the model answer for each part (A, B, C, D).
- Generate a JSON object with marks and feedback.

**Question Details:**
Stem: {stem}
Part A: {questionA} (Marks: 1)
Part B: {questionB} (Marks: 2)
Part C: {questionC} (Marks: 3)
Part D: {questionD} (Marks: 4)

**Model Answers:**
Answer A: {answerA}
Answer B: {answerB}
Answer C: {answerC}
Answer D: {answerD}

{format_instructions}

The student has provided {image_count} images for their answer. Please begin your evaluation now.

**IMPORTANT:** Do not include any introductory text, concluding text, or any conversational filler. Your entire response must be ONLY the JSON object that adheres to the schema, enclosed in a single markdown code block.
`;

const singleQuestionPrompt = new PromptTemplate({
    template: singleQuestionPromptTemplate,
    inputVariables: ["stem", "questionA", "questionB", "questionC", "questionD", "answerA", "answerB", "answerC", "answerD", "image_count"],
    partialVariables: { format_instructions: singleQuestionParser.getFormatInstructions() },
});

// =============================================================
// ==      PART 2: OVERALL EXAM FEEDBACK SETUP                ==
// =============================================================

const overallFeedbackParser = new StringOutputParser();

const overallFeedbackPromptTemplate = `You are an encouraging and insightful AI Academic Advisor for Bangladeshi students. Your task is to write a comprehensive, constructive, and motivating overall feedback summary for a student's entire exam performance.

**Context:**
The student has completed a creative question (CQ) exam. You will be provided with a summary of their performance on each question, including the marks they obtained and the specific feedback they received for that question.

**Your Task:**
Based on the provided per-question results, generate a single, cohesive paragraph of overall feedback.
1.  **Start with Encouragement:** Begin by acknowledging the student's effort and highlighting their strengths. Point out topics or types of questions where they performed well.
2.  **Identify Patterns:** Analyze the feedback across all questions. Identify recurring issues, such as calculation errors, conceptual misunderstandings, incomplete answers, or misinterpreting questions.
3.  **Provide Actionable Advice:** Offer specific, actionable suggestions for improvement. For example, "Focus on reviewing the definitions in Chapter 5," or "Practice more numerical problems involving conservation of momentum," or "Double-check your calculations before moving to the next part."
4.  **Maintain a Positive Tone:** The feedback should be motivating and aim to build the student's confidence, not discourage them.

**Per-Question Performance Summary:**
{performance_summary}

**Instructions:**
Write the overall feedback paragraph now. Do not include any conversational filler like "Here is the feedback:". Just provide the paragraph directly.
`;

const overallFeedbackPrompt = new PromptTemplate({
    template: overallFeedbackPromptTemplate,
    inputVariables: ["performance_summary"],
});


// =============================================================
// ==      PART 3: HELPER FUNCTIONS                           ==
// =============================================================

async function prepareImagesForLLM(imageFiles) {
    const imageParts = [];
    for (const file of imageFiles) {
        const buffer = await fs.readFile(file.path);
        const base64 = buffer.toString('base64');
        imageParts.push({
            type: "image_url",
            image_url: `data:${file.mimetype};base64,${base64}`
        });
    }
    return imageParts;
}

function groupFilesByFieldname(files) {
  const grouped = {};
  files.forEach(file => {
    const fieldname = file.fieldname; // This is the questionId
    if (!grouped[fieldname]) {
      grouped[fieldname] = [];
    }
    grouped[fieldname].push(file);
  });
  return grouped;
}

// =============================================================
// ==      PART 4: SERVICE FUNCTIONS                          ==
// =============================================================

/**
 * Worker Function: Evaluates and saves the answer for a single creative question.
 * @returns {Promise<Document>} The saved AnswerEvaluation document.
 */
export async function evaluateAndSaveAnswer({ userId, examId, questionId, originalImageFiles }) {
    if (!originalImageFiles || originalImageFiles.length === 0) {
        throw new Error(`No image files were provided for question ${questionId}.`);
    }
    
    try {
        // STEP 1: UPLOAD ORIGINALS & GET QUESTION DATA
        const uploadPromises = originalImageFiles.map(file => 
            uploadImage(file.path, { folder: `originals/${examId}` })
        );
        const [uploadResults, question] = await Promise.all([
            Promise.all(uploadPromises),
            CreativeQuestion.findById(questionId).lean()
        ]);

        const originalImageUrls = uploadResults.map(result => {
            if (!result.success) throw new Error(`Cloudinary upload failed: ${result.error}`);
            return result.data.url;
        });

        if (!question) throw new Error(`Question with ID ${questionId} not found`);
        
        // STEP 2: PREPARE AND INVOKE AI FOR SINGLE QUESTION EVALUATION
        const studentImageParts = await prepareImagesForLLM(originalImageFiles);
        const chain = evaluatorLLM.pipe(singleQuestionParser);

        const formattedPromptText = await singleQuestionPrompt.format({
            stem: question.stem,
            questionA: question.a, questionB: question.b, questionC: question.c, questionD: question.d,
            answerA: question.aAnswer, answerB: question.bAnswer, answerC: question.cAnswer, answerD: question.dAnswer,
            image_count: originalImageFiles.length,
        });

        const response = await chain.invoke({
            messages: [{
                role: 'user',
                content: [ { type: 'text', text: formattedPromptText }, ...studentImageParts ],
            }]
        });
        
        // STEP 3: CONSTRUCT AND SAVE THE EVALUATION SUB-DOCUMENT
        const evaluation = new AnswerEvaluation({
            userId, examId, questionId,
            originalImages: originalImageUrls,
            marksA: response.marksA, marksB: response.marksB, marksC: response.marksC, marksD: response.marksD,
            feedbackA: response.feedbackA, feedbackB: response.feedbackB, feedbackC: response.feedbackC, feedbackD: response.feedbackD,
            handWriting: response.handWriting,
            feedback: response.overallFeedback,
            totalMarks: 10,
        });
        
        // Note: We don't call .save() here because this will be a sub-document
        // within the main CqResult. The parent's .save() will handle it.

        // STEP 4: CLEANUP
        originalImageFiles.forEach(file => fs.unlink(file.path).catch(err => console.error(`Failed to delete temp file: ${file.path}`, err)));

        console.log(`✅ Evaluation generated successfully for question ${questionId}`);
        return evaluation; // Return the unsaved document object

    } catch (error) {
        console.error(`🚨 FAILED to evaluate question ${questionId} for user ${userId}. Error:`, error.message);
        originalImageFiles.forEach(file => fs.unlink(file.path).catch(err => console.error(`Failed to delete temp file during error handling: ${file.path}`, err)));
        // Re-throw to be caught by Promise.allSettled in the orchestrator
        throw new Error(`Evaluation failed for question ${questionId}: ${error.message}`);
    }
}

/**
 * Orchestrator Function: Manages the evaluation of an entire exam.
 * @param {object} examData
 * @param {string} examData.userId
 * @param {string} examData.examId
 * @param {Array<object>} examData.allImageFiles - The flat array of files from req.files.
 * @returns {Promise<Document>} The final, saved CqResult document.
 */
export async function examEvaluate({ userId, examId, allImageFiles }) {
    console.log(`🚀 Starting full exam evaluation for exam: ${examId}, user: ${userId}`);

    const imagesByQuestionId = groupFilesByFieldname(allImageFiles);
    const questionIds = Object.keys(imagesByQuestionId);

    const resultDoc = new CqResult({
        examId,
        userId,
        status: 'evaluating',
        answers: [],
    });
    await resultDoc.save();

    try {
        const evaluationPromises = questionIds.map(questionId => 
            evaluateAndSaveAnswer({
                userId,
                examId,
                questionId,
                originalImageFiles: imagesByQuestionId[questionId],
            })
        );
        
        const evaluationOutcomes = await Promise.allSettled(evaluationPromises);

        const successfulEvaluations = [];
        const failedEvaluations = [];

        evaluationOutcomes.forEach((outcome, index) => {
            if (outcome.status === 'fulfilled') {
                successfulEvaluations.push(outcome.value);
            } else {
                failedEvaluations.push({ 
                    questionId: questionIds[index], 
                    reason: outcome.reason.message 
                });
            }
        });

        resultDoc.answers = successfulEvaluations;

        // ======================= FIX IS HERE =======================
        if (successfulEvaluations.length > 0) {
            // Step 1: Prepare the summary text as before.
            let performance_summary = successfulEvaluations.map((ans, i) => 
                `Question ${i + 1}:\n- Marks Obtained: ${ans.marksObtained} out of ${ans.totalMarks}\n- Feedback: ${ans.feedback}\n`
            ).join('\n');

            // Step 2: Manually format the prompt to get the final string.
            const overallFeedbackText = await overallFeedbackPrompt.format({ performance_summary });

            // Step 3: Create a simple chain for this specific task.
            const feedbackGenerationChain = evaluatorLLM.pipe(overallFeedbackParser);

            // Step 4: Invoke the chain with the input structure that evaluatorLLM expects.
            const overallFeedback = await feedbackGenerationChain.invoke({
                messages: [{
                    role: 'user',
                    content: overallFeedbackText,
                }],
            });

            resultDoc.feedback = overallFeedback;
        } else {
             resultDoc.feedback = "No questions could be successfully evaluated. Please review the submission.";
        }
        // ======================= END OF FIX =======================
        
        if (failedEvaluations.length > 0) {
            resultDoc.status = 'review_required';
            resultDoc.errorMessage = `Failed to evaluate ${failedEvaluations.length} question(s). Details: ${JSON.stringify(failedEvaluations)}`;
            console.warn(`Evaluation for exam ${examId} completed with ${failedEvaluations.length} errors.`);
        } else {
            resultDoc.status = 'evaluated';
            console.log(`✅ Full exam evaluation completed successfully for exam ${examId}.`);
        }

        resultDoc.evaluatedAt = new Date();
        
        await resultDoc.save();
        return resultDoc;

    } catch (error) {
        console.error(`🚨 CATASTROPHIC FAILURE during exam evaluation for exam ${examId}. Error:`, error);
        resultDoc.status = 'error';
        resultDoc.errorMessage = `A system error occurred: ${error.message}`;
        await resultDoc.save();
        throw error;
    }
}