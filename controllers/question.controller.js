// question.controller.js

import * as questionService from '../services/question.service.js';
import { errorResponse, successResponse } from '../utils/response.js';

/**
 * Controller to get subjects for the authenticated user.
 */
export const getUserSubjects = async (req, res) => {
   try {
        const { level, version, group } = req.user;
        if (!level || !version || !group) {
            return errorResponse(res, 400, "User profile is incomplete. Level, version, and group are required.");
        }
        const subjects = await questionService.getSubjectsForUser(level, version, group);
        successResponse(res, 200, "Subjects fetched successfully", subjects);
   } catch (error) {
        console.error("Error fetching user subjects:", error);
        errorResponse(res, 500, "Failed to fetch subjects.", error.message);
   }
};

/**
 * Controller to get filter options (chapters, topics, types) for a given subject.
 */
export const getSubjectFilterData = async (req, res) => {
    try {
        const { subjectId } = req.params;
        console.log("subject id" , subjectId)
        if (!subjectId) {
            return errorResponse(res, 400, "Subject ID is required.");
        }

        const filterData = await questionService.getFilterOptionsForSubject(subjectId);
        
        successResponse(res, 200, "Filter data fetched successfully", filterData);
    } catch (error) {
        console.error("Error fetching subject filter data:", error);
        errorResponse(res, 500, "Failed to fetch filter data.", error.message);
    }
};

/**
 * Controller to get creative questions based on various filters from query parameters.
 */
export const getCreativeQuestions = async (req, res) => {
    try {
        // We only need subjectId, the rest are optional filters
        const { subjectId } = req.query;
        if (!subjectId) {
            return errorResponse(res, 400, "A subjectId is required to fetch questions.");
        }

        const filters = req.query; // Pass the whole query object to the service
        console.log(filters)
        const questions = await questionService.getFilteredCreativeQuestions(filters, req.user.version);
        successResponse(res, 200, "Questions fetched successfully", questions);
    } catch (error) {
        console.error("Error fetching creative questions:", error);
        errorResponse(res, 500, "Failed to fetch questions.", error.message);
    }
};