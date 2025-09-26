// routes/user.routes.js
import express from 'express';
import { 
  getProfile, 
  updateProfile, 
  updatePreferencesController,
  checkProfileCompletion,
  getAllChats,
  getAIChat,
  getCqExamStateController,
  getCqExamController,
  startCqExamController,
  finishCqExamController,
  getExamHistoryController,
  // --- NEW IMPORTS ---
  getMcqExamStateController,
  startMcqExamController,
  submitMcqExamController,
  getLeaderboardController,
  getUserAnalyticsController,
  getUserRecommendationsController
} from '../controllers/user.controller.js';
import { authenticateJWT ,authenTicateSession} from '../middlewares/auth.js';
import { validateProfileUpdate } from '../middlewares/validation.js';
import { getAllExamReport } from '../services/report.service.js';
import { markAuraMessageAsSeen } from '../services/user.service.js';

const router = express.Router();

// All routes are protected
router.use(authenTicateSession);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validateProfileUpdate, updateProfile);
router.get('/profile/status',  checkProfileCompletion);
router.get('/chats',getAllChats );
router.get('/chats/:chatId',getAIChat );

// Preferences routes
router.put('/preferences', updatePreferencesController);

// CQ Exam routes
router.get('/exam/cq/:examId', getCqExamStateController);
router.post('/exam/cq/:examId/start', startCqExamController);
router.post('/exam/cq/:examId/finish', finishCqExamController);
router.get('/analytics', getUserAnalyticsController);
// --- NEW MCQ Exam routes ---
router.get('/exam/mcq/:examId', getMcqExamStateController);
router.post('/exam/mcq/:examId/start', startMcqExamController);
router.post('/exam/mcq/:examId/submit', submitMcqExamController); // Using /submit for clarity

// General exam history
router.get('/exams/history', getExamHistoryController);

router.post('/exams/auraSeen', markAuraMessageAsSeen)
// Report routes
router.get('/report', getAllExamReport);
router.get('/leaderboard', getLeaderboardController);
router.get('/recommendations', getUserRecommendationsController);


export default router;