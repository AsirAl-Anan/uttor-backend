// controllers/hub.controller.js
import { successResponse, errorResponse } from '../utils/response.js';
import { createDoubt, voteOnDoubt ,getAllDoubts, getDoubtById, postAnswer, voteOnAnswer ,postReply} from '../services/hub.service.js';

export const createDoubtController = async (req, res) => {
    try {
        const userId = req.user._id;
        const doubtData = req.body;
        const images = req.files?.hub || []; // 'hub' comes from your multer config

        if (!doubtData.title || !doubtData.body) {
            return errorResponse(res, 400, 'Title and body are required.');
        }

        const newDoubt = await createDoubt(userId, doubtData, images);
        return successResponse(res, 201, 'Doubt posted successfully', newDoubt);
    } catch (error) {
        console.error('Error creating doubt:', error);
        return errorResponse(res, 500, 'Failed to post doubt', error.message);
    }
};

export const voteDoubtController = async (req, res) => {
    try {
        const userId = req.user._id;
        const { doubtId } = req.params;
        const { voteType } = req.body; // 'up' or 'down'

        if (!['up', 'down'].includes(voteType)) {
            return errorResponse(res, 400, 'Invalid vote type. Must be "up" or "down".');
        }

        const updatedDoubt = await voteOnDoubt(userId, doubtId, voteType);
        return successResponse(res, 200, 'Vote cast successfully', updatedDoubt);
    } catch (error) {
        console.error('Error voting on doubt:', error);
        return errorResponse(res, 404, error.message || 'Failed to cast vote');
    }
};
export const getAllDoubtsController = async (req, res) => {
    try {
        const doubts = await getAllDoubts();
        return successResponse(res, 200, 'Doubts fetched successfully', doubts);
    } catch (error) {
        console.error('Error fetching doubts:', error);
        return errorResponse(res, 500, 'Failed to fetch doubts', error.message);
    }
};

export const getDoubtByIdController = async (req, res) => {
    try {
        const { doubtId } = req.params;
        const doubt = await getDoubtById(doubtId);
        return successResponse(res, 200, 'Doubt fetched successfully', doubt);
    } catch (error) {
        console.error('Error fetching doubt by ID:', error);
        return errorResponse(res, 404, error.message || 'Failed to fetch doubt');
    }
};



export const voteAnswerController = async (req, res) => {
    try {
        const userId = req.user._id;
        const { answerId } = req.params;
        const { voteType } = req.body;

        if (!['up', 'down'].includes(voteType)) {
            return errorResponse(res, 400, 'Invalid vote type.');
        }

        const updatedAnswer = await voteOnAnswer(userId, answerId, voteType);
        return successResponse(res, 200, 'Vote cast successfully', updatedAnswer);
    } catch (error) {
        console.error('Error voting on answer:', error);
        return errorResponse(res, 404, error.message || 'Failed to cast vote');
    }
};
export const postAnswerController = async (req, res) => {
    try {
        const { doubtId } = req.params;
        const userId = req.user._id;
        const { body } = req.body;
        const files = req.files?.hub || []; // Handle uploaded files

        // --- FIX: Allow posts with images but no body text ---
        if (!body && files.length === 0) {
            return errorResponse(res, 400, 'Answer must contain text or an image.');
        }

        // Pass files to the service
        const answer = await postAnswer(userId, doubtId, body, files);
        return successResponse(res, 201, 'Answer posted successfully', answer);
    } catch (error) {
        console.error('Error posting answer:', error);
        return errorResponse(res, 500, error.message || 'Failed to post answer');
    }
};

// ... (keep voteAnswerController as it is)

export const postReplyController = async (req, res) => {
    try {
       const { answerId } = req.params;
        const userId = req.user._id;
        const { body } = req.body;
        const files = req.files?.hub || []; // Handle uploaded files
        
        // --- FIX: Allow replies with images but no body text ---
        if (!body && files.length === 0) {
            return errorResponse(res, 400, 'Reply must contain text or an image.');
        }
        
        // Pass files to the service
        const reply = await postReply(userId, answerId, body, files);
        return successResponse(res, 201, 'Reply posted successfully', reply);
    } catch (error) {
        console.error('Error posting reply:', error);
        return errorResponse(res, 500, error.message || 'Failed to post reply');
    }
};