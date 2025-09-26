// backend/src/services/aiExam.service.js

import { ocrChain } from '../llm/chains/ocr.chain.js';
import { mcqGenerationChain } from '../llm/chains/mcq.generation.chain.js';
import logger from '../utils/logger.js';

/**
 * @description Performs OCR on an image using the dedicated ocrChain.
 * @param {string} imageUrl - The URL of the image to process.
 * @returns {Promise<string>} The extracted text from the image.
 * @throws {Error} Throws a user-friendly error if OCR fails or text is insufficient.
 */
const performOcr = async (imageUrl) => {
    logger.info(`[AI Exam Service] Performing OCR on image: ${imageUrl}`);
    try {
        const extractedText = await ocrChain.invoke({ image_url: imageUrl });
        
        // Basic sanity check on OCR output to fail early.
        if (!extractedText || extractedText.trim().length < 50) {
            logger.warn('[AI Exam Service] OCR result is too short or empty.');
            throw new Error('The image may not contain enough readable text. Please use a clearer image.');
        }
        
        logger.info(`[AI Exam Service] OCR successful. Extracted text length: ${extractedText.length}`);
        return extractedText;

    } catch (error) {
        logger.error('[AI Exam Service] OCR Chain failed:', error);
        throw new Error('Failed to extract text from the provided image. Please try another one.');
    }
};

/**
 * @description Generates MCQs from text using the mcqGenerationChain.
 * @param {object} params - The parameters for MCQ generation.
 * @param {string} params.text - The source text for generating questions.
 * @param {string} params.subject - The subject of the MCQs.
 * @param {string} params.chapter - The chapter of the MCQs.
 * @param {number} params.count - The number of MCQs to generate.
 * @param {string} params.userLanguage - The language for the user.
 * @returns {Promise<Array<object>>} An array of generated MCQ objects.
 * @throws {Error} Throws a user-friendly error if generation fails or format is invalid.
 */
const generateMcqsFromText = async ({ text, subject, chapter, count, userLanguage }) => {
    logger.info(`[AI Exam Service] Generating ${count} MCQs for ${subject} - ${chapter}`);
    try {
        const generatedQuestions = await mcqGenerationChain.invoke({
            context: text,
            subject,
            chapter,
            question_count: count,
            user_Language: userLanguage,
        });

        // The JsonOutputParser will throw if the format is invalid, but we should
        // still validate that we received a non-empty array.
        if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
            logger.warn('[AI Exam Service] MCQ generation returned an empty or invalid array.');
            throw new Error('The AI failed to generate questions in the expected format.');
        }
        
        logger.info(`[AI Exam Service] Successfully generated ${generatedQuestions.length} MCQs.`);
        return generatedQuestions;

    } catch (error) {
        logger.error('[AI Exam Service] MCQ Generation Chain failed:', error);
        // This could be a JSON parsing error or a model error.
        throw new Error('The AI could not generate valid questions from the text. The topic might be too complex or the image text unclear.');
    }
};

/**
 * @description Orchestrates the creation of an MCQ exam from an image by first
 * performing OCR and then generating questions from the extracted text.
 * @param {object} params - The parameters for exam creation.
 * @param {string} params.imageUrl - The URL of the source image.
 * @param {string} params.subject - The exam subject.
 * @param {string} params.chapter - The exam chapter.
 * @param {number} params.count - The number of questions to generate.
 * @param {string} params.userLanguage - The language for the user.
 * @returns {Promise<Array<object>>} A promise that resolves to an array of MCQ objects.
 */
export const createMcqExamFromImage = async ({ imageUrl, subject, chapter, count, userLanguage }) => {
    try {
        // Step 1: Extract text from the image
        const extractedText = await performOcr(imageUrl);
        
        // Step 2: Generate MCQs from the extracted text
        const mcqs = await generateMcqsFromText({
            text: extractedText,
            subject,
            chapter,
            count,
            userLanguage
        });
        
        return mcqs;
    } catch (error) {
        logger.error('[AI Exam Service] Error in the end-to-end MCQ creation flow:', error.message);
        // Re-throw the specific, user-friendly error from the failed step
        throw error;
    }
};