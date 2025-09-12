// auth.controller.js
import passport from 'passport';
import { handleGoogleCallback, setAuthCookie } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Google OAuth login
export const googleLogin = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// Google OAuth callback
export const googleCallback = [
  // Step 1: Passport authenticates and attaches req.user
  passport.authenticate('google', { failureRedirect: '/login' }),

  // Step 2: Handle session and redirect
  async (req, res) => {
    try {
      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        return errorResponse(res, 401, 'User not found after authentication');
      }

      // Step 3: Log the user in (passport sets req.session.passport.user)
      req.login(authenticatedUser, async (err) => {
        if (err) {
          console.error('Login error:', err);
          return errorResponse(res, 500, 'Failed to log in user');
        }

        // Step 4: Optionally, you can regenerate session for fixation protection
        // If you do, do it BEFORE req.login. Here, we skip regenerate for simplicity.

        // Step 5: Handle JWT and cookie for frontend
        const { user, token } = await handleGoogleCallback(authenticatedUser);
        setAuthCookie(res, token); // keeps your frontend stateless auth if needed

        // Step 6: Save the session explicitly before redirecting
        req.session.save((err) => {
          if (err) {
            console.error('Session save error:', err);
            return errorResponse(res, 500, 'Failed to save session');
          }

          // Step 7: Redirect to dashboard or onboarding
          const redirectUrl = user.isProfileComplete
            ? `${process.env.FRONTEND_URL}/dashboard`
            : `${process.env.FRONTEND_URL}/onboarding`;

          res.redirect(redirectUrl);
        });
      });

    } catch (error) {
      console.error('Callback error:', error);
      return errorResponse(res, 500, 'Authentication failed', error.message);
    }
  }
];

// Logout
export const logout = (req, res) => {
  res.clearCookie('token'); // your JWT
  req.logout((err) => {
    if (err) console.error('Logout error:', err);

    req.session.destroy((err) => {
      if (err) console.error('Session destruction error:', err);

      return successResponse(res, 200, 'Logged out successfully');
    });
  });
};
