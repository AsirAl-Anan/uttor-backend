// exam.controller.js (or wherever your startEvaluation function is)

import { examEvaluate } from '../services/evaluation.service.js';

/**
 * @description Controller to start the evaluation process for an entire CQ exam.
 * @route POST /api/v1/exams/evaluate
 * @access Private (User)
 */
export const startEvaluation = async (req, res) => {
    try {
        // 1. Extract data from the incoming request.
        // The `examId` is sent in the form-data body.
        const { examId } = req.body;
        
        // The `userId` is attached by the authentication middleware.
        const userId = req.user?._id;

        // `req.files` will be a flat array of all uploaded images from multer.
        // The `fieldname` of each file object corresponds to its `questionId`.
        const allImageFiles = req.files;

        // 2. Validate the incoming data.
        if (!userId) {
            // This is an authentication/authorization issue.
            return res.status(401).json({
                success: false,
                message: "User not authenticated. Please log in."
            });
        }

        if (!examId || !allImageFiles || allImageFiles.length === 0) {
            // This is a client-side error (bad request).
            return res.status(400).json({
                success: false,
                message: "Missing examId or image files. Both are required for evaluation."
            });
        }

        console.log(`[Controller] Received request to evaluate exam ${examId} for user ${userId} with ${allImageFiles.length} image(s).`);

        // 3. Call the main orchestrator service function.
        // The 'await' ensures that if examEvaluate throws an error, it will be caught by the 'catch' block.
        const result = await examEvaluate({
            userId,
            examId,
            allImageFiles,
        });

        // 4. Send a success response back to the client.
        // The `result` object is the final, saved `CqResult` document.
        return res.status(200).json({
            success: true,
            message: "Exam evaluation process initiated and completed successfully.",
            data: result,
        });

    } catch (error) {
        // 5. Catch any errors that occurred during the 'try' block.
        // This could be from the service function or any other unexpected issue.
        console.error("--- EVALUATION CONTROLLER ERROR ---");
        console.error(error); // Log the full error to the server console for debugging.
        
        // Send a generic 500 Internal Server Error response to the client.
        return res.status(500).json({
            success: false,
            message: "An unexpected error occurred on the server during the evaluation process.",
            // Avoid sending detailed error messages to the client in production for security.
            // error: error.message // You might include this during development for easier debugging.
        });
    }
};