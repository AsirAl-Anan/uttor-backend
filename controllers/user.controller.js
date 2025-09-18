//user controller
import { Chat } from '../models/chat.model.js';
import { 
  updateUserProfile, 
  getUserProfile, 
  updatePreferences ,
  
} from '../services/profile.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { getChatById, getCqExam, getExamAndAttempt, startExamAttempt, finishExamAttempt } from '../services/user.service.js';
// Get current user profile
export const getProfile = async (req, res) => {
  try {
   
    const user = await getUserProfile(req.user._id)
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }
    return successResponse(res, 200, 'Profile fetched successfully', user);
  } catch (error) {
    console.log(error)
    return errorResponse(res, 500, 'Failed to fetch profile', error.message);
  }
};

// Update user profile (consecutive update after login)
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

// Update user preferences
export const updatePreferencesController = async (req, res) => {
  try {
    const data = {
      theme: req.body.theme,
      appLanguage: req.body.language === "en" ? "English" : "Bangla",
    }
    const preferences = await updatePreferences(req.user._id, data);
    return successResponse(res, 200, 'Preferences updated successfully', preferences);
  } catch (error) {
    return errorResponse(res, 500, 'Failed to update preferences', error.message);
  }
};

// Check if profile is complete
export const checkProfileCompletion = async (req, res) => {
  try {
    const user = await getUserProfile(req.user._id);
    return successResponse(res, 200, 'Profile status checked', {
      isComplete: user.isProfileComplete,
      missingFields: getMissingFields(user)
    });
  } catch (error) {
    return errorResponse(res, 500, 'Failed to check profile status', error.message);
  }
};

// Helper function to identify missing required fields
const getMissingFields = (user) => {
  const requiredFields = ['username', 'level', 'version', 'group', 'board'];
  const missing = [];
  
  requiredFields.forEach(field => {
    if (!user[field]) {
      missing.push(field);
    }
  });
  
  return missing;
};
export const getAllChats = async (req, res) => {
  try {
    const chats = await Chat.find({ user: req.user._id })
      .select("title createdAt _id") // only include title + createdAt
      .sort({ createdAt: -1 }); // newest first

    return successResponse(res, 200, "Chats fetched successfully", chats);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch chats", error.message);
  }
};

export const getAIChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await getChatById(req.user._id, chatId);
    if (!chat) {
      return errorResponse(res, 404, "Chat not found");
    }
    return successResponse(res, 200, "Chat fetched successfully", chat);
  } catch (error) {
    return errorResponse(res, 500, "Failed to fetch chat", error.message);
  }
}
/**
 * Controller to get a single Creative Question (CQ) exam by its ID.
 */
export const getCqExamController = async (req, res) => {
  try {
    const { examId } = req.params;
    
    // Call the service to fetch the exam data
    const exam = await getCqExam(examId);
    console.log(exam)
    // If no exam is found with the given ID, return a 404 error
    if (!exam) {
      return errorResponse(res, 404, 'Exam not found');
    }

    // If the exam is found, return it in a success response
    return successResponse(res, 200, 'Exam fetched successfully', exam);

  } catch (error) {
    // Handle any unexpected errors during the process
    console.log(error);
    return errorResponse(res, 500, 'Failed to fetch exam', error.message);
  }
}
export const getCqExamStateController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id; // Assuming auth middleware provides this

        // This service correctly returns { exam, attempt }
        const data = await getExamAndAttempt(examId, userId);

        return successResponse(res, 200, 'Exam state fetched successfully', data);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 404, error.message || 'Failed to fetch exam state');
    }
};


/**
 * Controller to start a new exam attempt.
 */
export const startCqExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        
        const attempt = await startExamAttempt(examId, userId);
        
        return successResponse(res, 201, 'Exam started successfully', attempt);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 400, error.message || 'Failed to start exam');
    }
};

/**
 * Controller to finish an active exam attempt.
 */
export const finishCqExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        
        const attempt = await finishExamAttempt(examId, userId);
        
        return successResponse(res, 200, 'Exam finished successfully', attempt);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 400, error.message || 'Failed to finish exam');
    }
};