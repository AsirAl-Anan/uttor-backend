import Joi from 'joi';
import { errorResponse } from '../utils/response.js';

export const validateProfileUpdate = (req, res, next) => {
  const schema = Joi.object({
    username: Joi.string().min(3).max(30).optional(),
    nickname: Joi.string().max(50).optional(),
    level: Joi.string().valid('SSC', 'HSC').optional(),
    version: Joi.string().valid('Bangla', 'English').optional(),
    group: Joi.string().valid('Science', 'Business Studies', 'Humanities').optional(),
    board: Joi.string().valid(
      'Dhaka','Chattogram','Rajshahi','Khulna','Barishal','Sylhet','Comilla','Dinajpur','Mymensingh'
    ).optional(),
    institution: Joi.string().max(100).optional(),
    sscYear: Joi.number().min(2000).max(new Date().getFullYear() + 5).optional(),
    hscYear: Joi.number().min(2000).max(new Date().getFullYear() + 5).optional()
  });

  const { error } = schema.validate(req.body);
  
  if (error) {
    return errorResponse(res, 400, 'Validation error', 
      error.details.map(detail => detail.message)
    );
  }

  next();
};