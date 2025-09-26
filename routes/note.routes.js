import express from 'express';
import { authenTicateSession } from '../middlewares/auth.js';
import {
    getSubjectsController,
    getChaptersController,
    getTopicsController,
    getTopicDetailsController,
} from '../controllers/note.controller.js';

const router = express.Router();

// All note-related routes require authentication
router.use(authenTicateSession);

// Route to get subjects relevant to the user
// GET /api/v1/notes/subjects
router.get('/subjects', getSubjectsController);

// Route to get chapters for a specific subject
// GET /api/v1/notes/subjects/:subjectId/chapters
router.get('/subjects/:subjectId/chapters', getChaptersController);

// Route to get topics (notes) for a specific chapter within a subject
// GET /api/v1/notes/subjects/:subjectId/chapters/:chapterId/topics
router.get('/subjects/:subjectId/chapters/:chapterId/topics', getTopicsController); // CHANGED HERE

// Route to get the full details of a single topic (note)
// GET /api/v1/notes/topics/:topicId
router.get('/topics/:topicId', getTopicDetailsController);

export default router;