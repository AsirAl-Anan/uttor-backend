import passport from 'passport';
import { handleGoogleCallback, setAuthCookie } from '../services/auth.service.js';
import { findUserById, updateUserProfile } from '../services/user.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Google OAuth login
export const googleLogin = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// Google OAuth callback
export const googleCallback = [
  passport.authenticate('google', { failureRedirect: '/login' }),
  async (req, res) => {
    try {
      const { user, token } = await handleGoogleCallback(req.user);
      setAuthCookie(res, token);
      
      const redirectUrl = `${process.env.FRONTEND_URL}/dashboard?login=success`;
      res.redirect(redirectUrl);
    } catch (error) {
      return errorResponse(res, 500, 'Authentication failed', error.message);
    }
  }
];

// Update user profile
export const updateProfile = async (req, res) => {
  try {
    const user = await updateUserProfile(req.user._id, req.body);
    return successResponse(res, 200, 'Profile updated successfully', user);
  } catch (error) {
    if (error.message === 'Username already taken') {
      return errorResponse(res, 400, error.message);
    }
    return errorResponse(res, 500, 'Failed to update profile', error.message);
  }
};

// Get current user
export const getCurrentUser = async (req, res) => {
  try {
    const user = await findUserById(req.user._id);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    return successResponse(res, 200, 'User fetched successfully', user);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to fetch user data', error.message);
  }
};

// Logout
export const logout = (req, res) => {
  res.clearCookie('token');
  req.logout(() => {});
  req.session.destroy(() => {});
  return successResponse(res, 200, 'Logged out successfully');
};