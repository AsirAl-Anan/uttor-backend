// question.routes.js

import { Router } from "express";
import { authenTicateSession } from "../middlewares/auth.js";
import { 
    getUserSubjects, 
    getSubjectFilterData, 
    getCreativeQuestions 
} from "../controllers/question.controller.js";

const router = Router();

// All question bank routes require an authenticated session
router.use(authenTicateSession);

/**
 * @route   GET /api/questions/subjects
 * @desc    Get all subjects available for the logged-in user's level, group, and version.
 * @access  Private
 */
router.get('/subjects', getUserSubjects);

/**
 * @route   GET /api/questions/subject-data/:subjectId
 * @desc    Get all chapters, topics, and question types for a specific subject to populate filters.
 * @access  Private
 */
router.get('/subject-data/:subjectId', getSubjectFilterData);

/**
 * @route   GET /api/questions
 * @desc    Get creative questions based on filter criteria provided in the query string.
 * @access  Private
 * @query   subjectId, board, year, chapterId, topicId, type
 */
router.get('/', getCreativeQuestions);


export default router;