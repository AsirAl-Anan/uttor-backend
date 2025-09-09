// auth.controller.js

import passport from 'passport';
import { handleGoogleCallback, setAuthCookie } from '../services/auth.service.js';
import { successResponse, errorResponse } from '../utils/response.js';

// Google OAuth login (no changes here)
export const googleLogin = passport.authenticate('google', { 
  scope: ['profile', 'email'] 
});

// --- NEW AND IMPROVED Google OAuth callback ---
export const googleCallback = [
  // This middleware still runs first to get req.user from Google
  passport.authenticate('google', { failureRedirect: '/login' }), 
  
  async (req, res) => {
    // At this point, passport has authenticated and attached `req.user`
    // but we will now take manual control of the session.
    try {
      const authenticatedUser = req.user;

      // 1. Manually log the user in. This triggers passport.serializeUser
      //    and attaches `req.session.passport.user`.
      req.login(authenticatedUser, (err) => {
        if (err) {
          console.error("Manual login error:", err);
          return errorResponse(res, 500, 'Authentication failed during login step');
        }

        // 2. Regenerate the session to prevent session fixation attacks.
        //    This creates a fresh session ID.
        req.session.regenerate(async (err) => {
          if (err) {
            console.error("Session regenerate error:", err);
            return errorResponse(res, 500, 'Authentication failed during session regeneration');
          }

          // 3. Manually put the passport user back into the new session.
          //    `req.login` already did this, but regenerate clears it.
          req.session.passport = { user: authenticatedUser.id };
          
          // Your original logic to create a JWT can still run
          const { user, token } = await handleGoogleCallback(authenticatedUser);
          setAuthCookie(res, token); // You can keep this for stateless API auth if needed

          // 4. Explicitly SAVE the session before redirecting.
          //    This is the most critical step. It ensures the data is written
          //    to Mongo and the Set-Cookie header is added to the response.
          req.session.save((err) => {
            if (err) {
              console.error("Session save error:", err);
              return errorResponse(res, 500, 'Authentication failed during session save');
            }

            // 5. Now that the session is saved, we can safely redirect.
            const redirectUrl = user.isProfileComplete 
              ? `${process.env.FRONTEND_URL}/dashboard`
              : `${process.env.FRONTEND_URL}/onboarding`;
            
            res.redirect(redirectUrl);
          });
        });
      });
    } catch (error) {
      return errorResponse(res, 500, 'Authentication failed', error.message);
    }
  }
];

// Logout (no changes here)
export const logout = (req, res) => {
  res.clearCookie('token');
  req.logout((err) => {
    if (err) { console.error('Logout error:', err); }
    req.session.destroy((err) => {
      if (err) { console.error('Session destruction error:', err); }
      return successResponse(res, 200, 'Logged out successfully');
    });
  });
};