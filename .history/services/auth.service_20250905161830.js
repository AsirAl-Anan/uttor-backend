import { generateToken } from '../utils/jwt.js';
import { findUserByGoogleId, createUser } from './user.service.js';

export const handleGoogleCallback = async (profile) => {
  try {
    let user = await findUserByGoogleId(profile.id);
    
    if (!user) {
      user = await createUser({
        googleId: profile.id,
        displayName: profile.displayName,
        email: profile.emails[0].value,
        avatar: profile.photos?.[0]?.value
      });
    }

    const token = generateToken(user._id);
    
    return {
      user,
      token
    };
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

export const setAuthCookie = (res, token) => {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};