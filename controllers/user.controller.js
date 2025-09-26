// controllers/user.controller.js
import { Chat } from '../models/chat.model.js';
import { 
  updateUserProfile, 
  getUserProfile, 
  updatePreferences,
} from '../services/profile.service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { 
    getChatById, 
    getCqExam, 
    getExamAndAttempt, 
    startExamAttempt, 
    finishExamAttempt, 
    getExamHistory,
    // --- NEW IMPORTS ---
    getMcqExamAndAttempt,
    startMcqExamAttempt,
    submitMcqExamAttempt ,
    getLeaderboard,
    getUserAnalytics,
    getUserRecommendations
} from '../services/user.service.js';
import { AnswerEvaluation, CqResult } from '../models/cq.result.model.js';

// ... (keep existing functions: getProfile, updateProfile, etc.)
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
      .select("title createdAt _id")
      .sort({ createdAt: -1 });
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
};

export const getCqExamController = async (req, res) => {
  try {
    const { examId } = req.params;
    const exam = await getCqExam(examId);
    if (!exam) {
      return errorResponse(res, 404, 'Exam not found');
    }
    return successResponse(res, 200, 'Exam fetched successfully', exam);
  } catch (error) {
    console.log(error);
    return errorResponse(res, 500, 'Failed to fetch exam', error.message);
  }
};

export const getCqExamStateController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        const data = await getExamAndAttempt(examId, userId);
        return successResponse(res, 200, 'Exam state fetched successfully', data);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 404, error.message || 'Failed to fetch exam state');
    }
};

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

export const getExamHistoryController = async (req, res) => {
  try {
    const userId = req.user._id;
    const history = await getExamHistory(userId);
    return successResponse(res, 200, 'Exam history fetched successfully', history);
  } catch (error) {
    console.error(error);
    return errorResponse(res, 500, 'Failed to fetch exam history', error.message);
  }
};

// --- NEW MCQ EXAM CONTROLLERS ---

/**
 * Controller to get the state of an MCQ exam (exam data + user attempt).
 */
export const getMcqExamStateController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        const data = await getMcqExamAndAttempt(examId, userId);
        return successResponse(res, 200, 'MCQ Exam state fetched successfully', data);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 404, error.message || 'Failed to fetch MCQ exam state');
    }
};

/**
 * Controller to start a new MCQ exam attempt.
 */
export const startMcqExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        const attempt = await startMcqExamAttempt(examId, userId);
        return successResponse(res, 201, 'MCQ Exam started successfully', attempt);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 400, error.message || 'Failed to start MCQ exam');
    }
};

/**
 * Controller to submit and evaluate an MCQ exam.
 */
export const submitMcqExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.user._id;
        const { answers } = req.body;
        
        if (!answers) {
            return errorResponse(res, 400, 'Answers are required for submission.');
        }

        const result = await submitMcqExamAttempt(examId, userId, answers);
        return successResponse(res, 200, 'MCQ Exam submitted and evaluated successfully', result);
    } catch (error) {
        console.log(error);
        return errorResponse(res, 400, error.message || 'Failed to submit MCQ exam');
    }
};
export const getLeaderboardController = async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const userId = req.user.id; // From authenTicateSession middleware

        const leaderboardData = await getLeaderboard({ page, limit, userId });

        res.status(200).json({
            success: true,
            data: leaderboardData,
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch leaderboard' });
    }
};
export const getUserAnalyticsController = async (req, res) => {
    try {
        const userId = req.user.id; // From authenTicateSession middleware

        const analyticsData = await getUserAnalytics(userId);

        res.status(200).json({
            success: true,
            data: analyticsData,
        });
    } catch (error) {
        console.error('Error fetching user analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch user analytics' });
    }
};
// --- ADD THIS NEW CONTROLLER FUNCTION ---
export const getUserRecommendationsController = async (req, res) => {
    try {
        const userId = req.user.id; // From authenTicateSession middleware
        const recommendations = await getUserRecommendations(userId);
        return successResponse(res, 200, 'Recommendations fetched successfully', recommendations);
    } catch (error) {
        console.error('Error fetching user recommendations:', error);
        return errorResponse(res, 500, 'Failed to fetch recommendations');
    }
};