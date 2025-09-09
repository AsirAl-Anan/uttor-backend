import express from 'express';
import { 
  getProfile, 
  updateProfile, 
  updatePreferencesController,
  checkProfileCompletion,
  getAllChats,
  getAIChat
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

export default router;