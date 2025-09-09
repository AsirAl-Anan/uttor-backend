import { generateToken } from '../utils/jwt.js';
import { findUserByGoogleId, createUser } from './user.service.js';
import jwt from 'jsonwebtoken';
export const handleGoogleCallback = async (profile) => {
  try {
   
    let user = await findUserByGoogleId(profile.googleId);
   
    if (!user) {
      user = await createUser({
        googleId: profile?.id,
        displayName: profile?.displayName,
        email: profile?.email,
        avatar: profile?.avatar
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

export const verifySocketToken = (token) => {
  if (!token) {
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // decoded looks like: { id: "...", iat: ..., exp: ... }
    return { userId: decoded.id };
  } catch (error) {
    console.error("Invalid socket token:", error.message);
    return null;
  }
};
