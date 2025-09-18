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
  finishCqExamController
} from '../controllers/user.controller.js';
import { authenticateJWT ,authenTicateSession} from '../middlewares/auth.js';
import { validateProfileUpdate } from '../middlewares/validation.js';

const router = express.Router();

// All routes are protected

router.use(authenTicateSession);
// Profile routes
router.get('/profile', getProfile);
// router.get('/session', getProfile);
router.put('/profile', validateProfileUpdate, updateProfile);
router.get('/profile/status',  checkProfileCompletion);
router.get('/chats',getAllChats )
router.get('/chats/:chatId',getAIChat )

// Preferences routes
router.put('/preferences', updatePreferencesController);

//exam
router.get('/exam/cq/:examId', getCqExamStateController)
router.post('/exam/cq/:examId/start',  startCqExamController);
router.post('/exam/cq/:examId/finish',  finishCqExamController);

export default router;