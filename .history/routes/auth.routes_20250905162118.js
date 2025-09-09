import express from 'express';
import { 
  googleLogin, 
  googleCallback, 
  updateProfile, 
  getCurrentUser, 
  logout 
} from '../controllers/auth.controller.js';
import { authenticateJWT } from '../middleware/auth.js';
import { validateProfileUpdate } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.get('/google', googleLogin);
router.get('/callback', googleCallback);

// Protected routes
router.put('/profile', authenticateJWT, validateProfileUpdate, updateProfile);
router.get('/me', authenticateJWT, getCurrentUser);
router.post('/logout', authenticateJWT, logout);

export default router;