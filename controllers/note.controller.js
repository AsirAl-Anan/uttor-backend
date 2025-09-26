import { successResponse, errorResponse } from '../utils/response.js';
import * as noteService from '../services/note.service.js';

/**
 * Controller to get a list of subjects relevant to the logged-in user.
 */
export const getSubjectsController = async (req, res) => {
    try {
        console.log('Fetching subjects for user:', req.user._id);
        const subjects = await noteService.getAllSubjectsForUser(req.user);
        return successResponse(res, 200, 'Subjects fetched successfully', subjects);
    } catch (error) {
        console.error('Error fetching subjects:', error);
        return errorResponse(res, 400, error.message || 'Failed to fetch subjects');
    }
};

/**
 * Controller to get the list of chapters for a specific subject.
 */
export const getChaptersController = async (req, res) => {
    try {
        const { subjectId } = req.params;
        const chapters = await noteService.getChaptersForSubject(subjectId);
        return successResponse(res, 200, 'Chapters fetched successfully', chapters);
    } catch (error) {
        console.error(`Error fetching chapters for subject ${req.params.subjectId}:`, error);
        return errorResponse(res, 404, error.message || 'Failed to fetch chapters');
    }
};

/**
 * Controller to get the topics (notes) for a specific chapter.
 */
export const getTopicsController = async (req, res) => {
    try {
        // CHANGED: Use chapterId instead of chapterIndex
        const { subjectId, chapterId } = req.params;
        console.log(`Fetching topics for subjectId: ${subjectId}, chapterId: ${chapterId}`);
        // REMOVED: The failing validation logic is no longer needed.
        // if (isNaN(index)) { ... }

        const topics = await noteService.getTopicsForChapter(subjectId, chapterId);
        return successResponse(res, 200, 'Notes fetched successfully', topics);
    } catch (error) {
        console.error(`Error fetching topics for chapter id ${req.params.chapterId}:`, error);
        return errorResponse(res, 404, error.message || 'Failed to fetch notes');
    }
};

/**
 * Controller to get the full details of a single topic (note).
 */
export const getTopicDetailsController = async (req, res) => {
    try {
        const { topicId } = req.params;
        const topic = await noteService.getTopicDetails(topicId);
        return successResponse(res, 200, 'Note details fetched successfully', topic);
    } catch (error) {
        console.error(`Error fetching topic details for ${req.params.topicId}:`, error);
        return errorResponse(res, 404, error.message || 'Failed to fetch note details');
    }
};