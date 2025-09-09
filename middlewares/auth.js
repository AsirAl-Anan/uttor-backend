import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { errorResponse } from '../utils/response.js';
export const authenticateJWT = async (req, res, next) => {
  try {
    console.log(true)
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
    console.log(error)
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 401, 'Invalid token.');
    }
    
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 401, 'Token expired.');
    }

    return errorResponse(res, 500, 'Authentication error.', error.message);
  }
};

export const authenTicateSession =async (req, res, next) => {
  console.log(req.session)
  if(!req.session.passport){
   
    return errorResponse(res, 401, 'Session not found.');
  }
  const userId = req.session?.passport.user
  if(!userId){
    return errorResponse(res, 401, 'User not found.');
  }
  const user = await User.findById(userId).populate('preferences');
  if(!user){
    return errorResponse(res, 404, 'User not found.');
  }
  req.user = user;
  next();

}
export const authenticateSocket = async (socket, next) => {
  const req = socket.request;
  if (!req.session?.passport) {
    console.log("it is  session yippe",req.session)
    return next(new Error("Session not found"));
  }

  const userId = req.session.passport.user;
  console.log("it is  userId yippe",userId)
  if (!userId) {
    return next(new Error("User not found in session"));
  }
  socket.user = {userId};
  next();
 
  // try {
  //   const user = await User.findById(userId).populate("preferences");
  //   if (!user) {
  //     return next(new Error("User not found in DB"));
  //   }
  //  console.log("it is fucking user yippe",user)
  //   socket.user = user._id; // attach user to socket
  //   next();
  // } catch (err) {
  //   console.error("Socket authentication error:", err);
  //   next(new Error("Authentication error"));
  // }
};