import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { errorResponse } from '../utils/response.js';

export const authenticateJWT = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return errorResponse(res, 401, 'Access denied. No token provided.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('preferences');
    
    if (!user) {
      return errorResponse(res, 401, 'Invalid token. User not found.');
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 401, 'Invalid token.');
    }
    
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Token expired.');
    }

    return errorResponse(res, 500, 'Authentication error.', error.message);
  }
};