import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const authenticateJWT = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ 
        message: 'Access denied. No token provided.' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).populate('preferences');
    
    if (!user) {
      return res.status(401).json({ 
        message: 'Invalid token. User not found.' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token.' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired.' 
      });
    }

    res.status(500).json({ 
      message: 'Authentication error.', 
      error: error.message 
    });
  }
};

export const requireProfileCompletion = (req, res, next) => {
  if (!req.user.isProfileComplete) {
    return res.status(403).json({ 
      message: 'Please complete your profile first.',
      profileComplete: false
    });
  }
  next();
};