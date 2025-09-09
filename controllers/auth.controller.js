import passport from 'passport';
import { handleGoogleCallback, setAuthCookie } from '../services/auth.service.js';
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
      console.log("req.user", req.user)
      const { user, token } = await handleGoogleCallback(req.user);
      setAuthCookie(res, token);
      
      // Redirect based on profile completion status
      const redirectUrl = user.isProfileComplete 
        ? `${process.env.FRONTEND_URL}/dashboard`
        : `${process.env.FRONTEND_URL}/onboarding`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      return errorResponse(res, 500, 'Authentication failed', error.message);
    }
  }
];

// Logout
export const logout = (req, res) => {
  res.clearCookie('token');
  req.logout(() => {});
  req.session.destroy(() => {});
  return successResponse(res, 200, 'Logged out successfully');
};