// services/user.service.js
import User from '../models/User.js';
import Preferences from '../models/preferences.js';
import { Chat } from '../models/chat.model.js';
import { Message } from '../models/message.model.js';
import { CqExam } from "../models/cq.exam.model.js";
import { CqResult } from "../models/cq.result.model.js";
import { AnswerEvaluation } from "../models/cq.result.model.js";
import CreativeQuestion from "../models/creativeQuestion.model.js";
import McqExam from "../models/mcq.exam.model.js";
import { MCQ } from "../models/mcq.exam.model.js";
import { McqResult } from '../models/mcq.result.model.js';
import { AuraTransaction } from '../models/auraTransaction.model.js';
import { UserActivity } from '../models/user.activity.model.js';
import Recommendation from '../models/recommendation.model.js';
export const findUserById = async (id) => {
  return await User.findById(id).populate('preferences');
};

export const findUserByGoogleId = async (googleId) => {
  return await User.findOne({ googleId }).populate('preferences');
};

export const createUser = async (userData) => {
  const user = await User.create(userData);
  
  // Create preferences for new user
  const preferences = await Preferences.create({ user: user._id });
  user.preferences = preferences._id;
  await user.save();
  
  return await User.findById(user._id).populate('preferences');
};

export const updateUserProfile = async (userId, updateData) => {
  // Check if username is unique
  if (updateData.username) {
    const existingUser = await User.findOne({ 
      username: updateData.username, 
      _id: { $ne: userId } 
    });
    
    if (existingUser) {
      throw new Error('Username already taken');
    }
  }

  const user = await User.findByIdAndUpdate(
    userId, 
    { ...updateData, isProfileComplete: true },
    { new: true, runValidators: true }
  ).populate('preferences');

  return user;
};

export const checkUsernameExists = async (username, excludeUserId = null) => {
  const query = { username };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  return await User.findOne(query);
};

export const getChatById = async (userId, chatId) => {
  const chat= await Chat.findOne({ _id: chatId, user: userId });
  const messagesId = chat ? chat.messages : [];
  const messages = await Message.find({ _id: { $in: messagesId } }).sort({ createdAt: 1 });
  console.log(messages);
  if (chat) {
    chat.messages = messages;
    
  }
  return chat;
  // return messages;
}

export const getCqExam = async (examId) => {
  return await CqExam.findById(examId).populate('questions');
}

export const getExamAndAttempt = async (examId, userId) => {
    const exam = await CqExam.findById(examId).populate('questions').lean();
    if (!exam) {
        throw new Error('Exam not found');
    }

    const attempt = exam.attempts.find(a => a.userId === userId.toString());

    if (!attempt) {
        delete exam.questions;
    } else if (attempt.status === 'completed') {
        const result = await CqResult.findOne({ examId, userId }).lean();
        if (result) {
            attempt.result = result;
        }
    } else { 
        exam.questions?.forEach(q => {
            delete q.aAnswer;
            delete q.bAnswer;
            delete q.cAnswer;
            delete q.dAnswer;
            delete q.cAnswerImage;
            delete q.dAnswerImage;
        });
    }
    return { exam, attempt: attempt || null };
};

export const startExamAttempt = async (examId, userId) => {
    const exam = await CqExam.findById(examId);
    if (!exam || !exam.isActive) {
        throw new Error('This exam is not available or no longer active');
    }
    const existingAttempt = exam.attempts.find(a => a.userId === userId.toString());
    if (existingAttempt) {
        throw new Error('You have already started this exam');
    }
    const newAttempt = {
        userId: userId.toString(),
        startTime: new Date(),
        status: 'in-progress',
    };
    await CqExam.findByIdAndUpdate(examId, {
        $push: { attempts: newAttempt }
    });
    return newAttempt;
};

export const finishExamAttempt = async (examId, userId) => {
    const exam = await CqExam.findOneAndUpdate(
        { 
            _id: examId, 
            'attempts.userId': userId.toString(),
            'attempts.status': 'in-progress'
        },
        { 
            $set: { 
                isActive: false,
                'attempts.$[elem].status': 'completed',
                'attempts.$[elem].endTime': new Date(),
            }
        },
        { 
            arrayFilters: [{ 'elem.userId': userId.toString() }],
            new: true 
        }
    );
    if (!exam) {
        throw new Error('No active exam attempt found to finish.');
    }
    return exam.attempts.find(a => a.userId === userId.toString());
};



export const getExamHistory = async (userId) => {
    // A string version of the userId is needed for matching inside arrays
    const userIdString = userId.toString();

    // Step 1: Fetch all MCQ and CQ exams the user has completed in parallel
    const [completedMcqExams, completedCqExams] = await Promise.all([
        McqExam.find({
            'attempts': { $elemMatch: { userId: userIdString, status: 'completed' } }
        }).select('title subject chapter totalMarks timeLimitInMinutes attempts createdAt').lean(),
        CqExam.find({
            'attempts': { $elemMatch: { userId: userIdString, status: 'completed' } }
        }).select('title subject chapter duration questions attempts createdAt').lean()
    ]);

    // Step 2: Extract exam IDs to fetch their corresponding results
    const mcqExamIds = completedMcqExams.map(exam => exam._id);
    const cqExamIds = completedCqExams.map(exam => exam._id);

    // Step 3: Fetch all relevant results for these exams in parallel
    const [mcqResults, cqResults] = await Promise.all([
        McqResult.find({ userId: userIdString, examId: { $in: mcqExamIds } }).lean(),
        CqResult.find({ userId: userIdString, examId: { $in: cqExamIds } }).lean()
    ]);
    
    // Step 4: Create maps for quick lookup of results by examId (O(1) access)
    const mcqResultsMap = new Map(mcqResults.map(r => [r.examId.toString(), r]));
    const cqResultsMap = new Map(cqResults.map(r => [r.examId.toString(), r]));

    // Step 5: Format MCQ exam history
    const formattedMcqHistory = completedMcqExams.map(exam => {
        const result = mcqResultsMap.get(exam._id.toString());
        const attempt = exam.attempts.find(a => a.userId === userIdString && a.status === 'completed');

        return {
            examId: exam._id,
            title: exam.title,
            type: 'MCQ',
            subject: exam.subject,
            chapter: exam.chapter,
            status: 'Evaluated', // MCQ results are instant
            score: result ? result.score : 0,
            totalMarks: exam.totalMarks,
            completedAt: attempt ? attempt.endTime : exam.updatedAt,
        };
    });

    // Step 6: Format CQ exam history
    const formattedCqHistory = completedCqExams.map(exam => {
        const result = cqResultsMap.get(exam._id.toString());
        const attempt = exam.attempts.find(a => a.userId === userIdString && a.status === 'completed');

        // Determine status based on result document
        let status = 'Awaiting Evaluation';
        if (result) {
            switch (result.status) {
                case 'evaluated':
                    status = 'Evaluated';
                    break;
                case 'evaluating':
                    status = 'Evaluating';
                    break;
                case 'review_required':
                    status = 'Review Required';
                    break;
                default:
                    status = 'Submitted';
            }
        }

        return {
            examId: exam._id,
            title: exam.title,
            type: 'CQ',
            subject: exam.subject,
            chapter: exam.chapter,
            status: status,
            score: result ? result.totalMarksObtained : null, // Use null to indicate not yet scored
            totalMarks: exam.questions.length * 10, // Each CQ is typically 10 marks (1+2+3+4)
            completedAt: attempt ? attempt.endTime : exam.updatedAt,
        };
    });

    // Step 7: Combine and sort the history by completion date (most recent first)
    const combinedHistory = [...formattedMcqHistory, ...formattedCqHistory];
    combinedHistory.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));

    return combinedHistory;
};
// ====================================================================

// --- NEW MCQ EXAM SERVICES ---

/**
 * Gets an MCQ exam and the user's attempt status for it.
 */
export const getMcqExamAndAttempt = async (examId, userId) => {
    const exam = await McqExam.findById(examId).lean();
    if (!exam) {
        throw new Error('MCQ Exam not found');
    }
   console.log(exam);
    const attempt = exam.attempts.find(a => a.userId === userId.toString());

    if (!attempt) {
        // Pre-start: don't send questions, but send the count
        exam.questionCount = exam.questions?.length || 0;
        delete exam.questions;
    } else if (attempt.status === 'completed') {
        // Review mode: fetch results and send full questions
        const result = await McqResult.findOne({ examId, userId }).lean();
        if (result) {
            attempt.result = result;
        }
    } else { // In-progress
        // In-progress: send questions but strip correct answers and explanations
        exam.questions?.forEach(q => {
            q.options.forEach(opt => {
                delete opt.isCorrect;
            });
            delete q.explanation;
        });
    }

    return { exam, attempt: attempt || null };
};

/**
 * Starts an MCQ exam attempt for a user.
 */
export const startMcqExamAttempt = async (examId, userId) => {
    const exam = await McqExam.findById(examId);
    if (!exam || !exam.isActive) {
        throw new Error('This MCQ exam is not available or no longer active');
    }

    const existingAttempt = exam.attempts.find(a => a.userId === userId.toString());
    if (existingAttempt) {
        throw new Error('You have already started this MCQ exam');
    }

    const newAttempt = {
        userId: userId.toString(),
        startTime: new Date(),
        status: 'in-progress',
        answers: {}
    };

    await McqExam.findByIdAndUpdate(examId, {
        $push: { attempts: newAttempt }
    });

    return newAttempt;
};

/**
 * Submits an MCQ exam, evaluates it, and marks it as finished.
 */
export const submitMcqExamAttempt = async (examId, userId, submittedAnswers) => {
    const exam = await McqExam.findById(examId);
    if (!exam) {
        throw new Error('MCQ Exam not found.');
    }
    
    const attempt = exam.attempts.find(a => a.userId === userId.toString() && a.status === 'in-progress');
    if (!attempt) {
        throw new Error('No active exam attempt found to submit.');
    }

    let score = 0;
    const resultAnswers = [];
    const answerKey = new Map(exam.questions.map(q => [q._id.toString(), q]));

    for (const questionId in submittedAnswers) {
        const question = answerKey.get(questionId);
        const selectedOptionId = submittedAnswers[questionId];
        
        if (question) {
            const correctOption = question.options.find(opt => opt.isCorrect);
            const isCorrect = correctOption.optionIdentifier === selectedOptionId;

            if (isCorrect) {
                score++;
            }
            resultAnswers.push({
                questionId: question._id,
                selectedOption: selectedOptionId,
                isCorrect: isCorrect,
            });
        }
    }

    const newResult = new McqResult({
        examId,
        userId,
        score,
        totalMarks: exam.questions.length,
        answers: resultAnswers,
        startTime: attempt.startTime,
        endTime: new Date(),
    });
    // ---- ADD THIS LINE to the newResult object ----
newResult.auraChange = totalAuraChange;
  await newResult.save(); 
   

    await McqExam.updateOne(
        { _id: examId, 'attempts.userId': userId.toString() },
        {
            $set: {
                'attempts.$.status': 'completed',
                'attempts.$.endTime': newResult.endTime,
                'attempts.$.answers': submittedAnswers,
            }
        }
    );

    // --- NEW: AURA CALCULATION & ACTIVITY LOGGING ---

    // 1. Calculate Aura points
    const correctAnswers = score;
    const incorrectAnswers = resultAnswers.length - correctAnswers;
    const auraFromCorrect = correctAnswers * 5;  // +5 for each correct answer
    const auraFromIncorrect = incorrectAnswers * -1; // -1 for each incorrect answer
    const totalAuraChange = auraFromCorrect + auraFromIncorrect;

    // 2. Update User's Aura and log the transaction
    if (totalAuraChange !== 0) {
        await User.findByIdAndUpdate(userId, { $inc: { aura: totalAuraChange } });
        await AuraTransaction.create({
            userId,
            points: totalAuraChange,
            source: {
                type: 'mcq_result',
                id: newResult._id,
            },
            reason: `MCQ Exam: ${correctAnswers} correct (+${auraFromCorrect}), ${incorrectAnswers} incorrect (${auraFromIncorrect}).`
        });
    }

    // 3. Log the exam submission activity
    await UserActivity.create({
        userId,
        activityType: 'exam_submitted',
        details: {
            examId,
            examType: 'mcq',
            message: `Submitted MCQ Exam: ${exam.title}`
        }
    });
    // --- END NEW SECTION ---

    return newResult;
};

// Add this new function to user.service.js
export const markAuraMessageAsSeen = async (resultId, examType) => {
    if (examType === 'cq') {
        return await CqResult.findByIdAndUpdate(resultId, { auraMessageSeen: true });
    } else if (examType === 'mcq') {
        return await McqResult.findByIdAndUpdate(resultId, { auraMessageSeen: true });
    }
    throw new Error('Invalid exam type for marking aura message as seen.');
};













// ====================================================================


// --- NEW MCQ EXAM SERVICES ---


/**
 * Gets an MCQ exam and the user's attempt status for it.
 */



/**
 * Starts an MCQ exam attempt for a user.
 */



/**
 * Submits an MCQ exam, evaluates it, and marks it as finished.
 */
/**
 * Submits an MCQ exam, evaluates it, and marks it as finished.
 */





// Add this new function to user.service.js

/**
 * Retrieves a paginated leaderboard of users based on their 'aura' score.
 * Also fetches the rank and score of the specified current user.
 * @param {object} options - The options for fetching the leaderboard.
 * @param {number} options.page - The current page number (1-indexed).
 * @param {number} options.limit - The number of users per page.
 * @param {string} options.userId - The ID of the currently logged-in user.
 * @returns {Promise<object>} An object containing the leaderboard, user's rank, and pagination details.
 */
export const getLeaderboard = async ({ page = 1, limit = 20, userId }) => {
    // Ensure page and limit are positive integers
    const pageNum = Math.max(1, page);
    const limitNum = Math.max(1, limit);
    const skip = (pageNum - 1) * limitNum;


    // Fields to be selected for leaderboard users to avoid exposing sensitive data
    const selection = 'name displayName avatar institution aura';


    // --- Perform database queries in parallel for efficiency ---
    const [
        leaderboardUsers,
        totalUsers,
        currentUser
    ] = await Promise.all([
        // 1. Get the users for the current page
        User.find()
            .sort({ aura: -1, updatedAt: 1 }) // Primary sort by aura, secondary by update time
            .skip(skip)
            .limit(limitNum)
            .select(selection)
            .lean(), // .lean() for faster read-only operations


        // 2. Get the total count of users for pagination
        User.countDocuments(),


        // 3. Get the current user's data
        User.findById(userId).select(selection).lean(),
    ]);


    let currentUserRank = null;
    if (currentUser) {
        // 4. Calculate the current user's rank by counting users with a higher aura
        const higherRankedUsers = await User.countDocuments({ aura: { $gt: currentUser.aura } });
        currentUserRank = {
            ...currentUser,
            rank: higherRankedUsers + 1,
        };
    }
   
    // --- Format the response ---
   
    // Add rank to each user in the leaderboard list
    const formattedLeaderboard = leaderboardUsers.map((user, index) => ({
        ...user,
        rank: skip + index + 1,
    }));


    return {
        leaderboard: formattedLeaderboard,
        currentUserRank,
        pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalUsers / limitNum),
            totalUsers,
            limit: limitNum,
        },
    };
};
export const getUserAnalytics = async (userId) => {
    // --- STEP 1: Run all independent database queries in parallel ---
    const [
        userData,
        mcqStats,
        cqStats,
        mcqDates,
        cqDates
    ] = await Promise.all([
        // Query 1: Get user's aura
        User.findById(userId).select('aura').lean(),


        // Query 2: Aggregate MCQ results to get total correct and total attempted
        McqResult.aggregate([
            { $match: { userId: userId.toString() } },
            { $unwind: '$answers' },
            {
                $group: {
                    _id: null,
                    totalCorrect: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
                    totalAttempted: { $sum: 1 }
                }
            }
        ]),


        // Query 3: Aggregate CQ results to get total marks and question count
        CqResult.aggregate([
            { $match: { userId: userId.toString(), status: 'evaluated' } },
            { $unwind: '$answers' },
            {
                $group: {
                    _id: null,
                    totalMarks: { $sum: '$answers.marksObtained' },
                    totalQuestions: { $sum: 1 }
                }
            }
        ]),


        // Query 4 & 5: Get completion dates for all exams to calculate streak
        McqResult.find({ userId: userId.toString() }).select('createdAt').lean(),
        CqResult.find({ userId: userId.toString(), status: 'evaluated' }).select('createdAt').lean()
    ]);


    // --- STEP 2: Calculate each analytic metric ---


    // AURA
    const aura = userData?.aura || 0;


    // MCQ ACCURACY
    const mcqAccuracyData = mcqStats[0];
    const mcqAccuracy = mcqAccuracyData && mcqAccuracyData.totalAttempted > 0
        ? (mcqAccuracyData.totalCorrect / mcqAccuracyData.totalAttempted) * 100
        : 0;
   
    // AVERAGE CQ SCORE
    const cqStatsData = cqStats[0];
    const averageCqScore = cqStatsData && cqStatsData.totalQuestions > 0
        ? cqStatsData.totalMarks / cqStatsData.totalQuestions
        : 0;


    // STREAK
    const allExamDates = [...mcqDates, ...cqDates].map(result => result.createdAt);
   
    // Get unique days (timestamps at midnight) to prevent multiple exams on the same day from counting extra
    const uniqueDays = new Set(
        allExamDates.map(date => new Date(date).setHours(0, 0, 0, 0))
    );
    const sortedDays = Array.from(uniqueDays).sort((a, b) => b - a);
   
    let streak = 0;
    if (sortedDays.length > 0) {
        const today = new Date().setHours(0, 0, 0, 0);
        const yesterday = new Date(today).setDate(new Date(today).getDate() - 1);
       
        // A streak is only valid if the last activity was today or yesterday
        if (sortedDays[0] === today || sortedDays[0] === yesterday) {
            streak = 1;
            for (let i = 0; i < sortedDays.length - 1; i++) {
                const currentDay = sortedDays[i];
                const previousDay = sortedDays[i+1];
                const oneDayInMs = 24 * 60 * 60 * 1000;
               
                // If the gap is exactly one day, continue the streak
                if (currentDay - previousDay === oneDayInMs) {
                    streak++;
                } else {
                    // If there's a gap, the consecutive streak ends
                    break;
                }
            }
        }
    }


    // --- STEP 3: Format and return the final object ---
    return {
        aura,
        streak,
        accuracy: parseFloat(mcqAccuracy.toFixed(2)), // Return as a clean float
        averageCqScore: parseFloat(averageCqScore.toFixed(2)),
    };
};



export const getUserRecommendations = async (userId) => {
  // Find the single recommendation document for the user
  const recommendationDoc = await Recommendation.findOne({ userId })
    .populate({
      path: 'recomendedTopics', // The field in the Recommendation schema
      select: 'name'            // From the Topic model, only select the 'name' field (_id is included by default)
    })
    .lean(); // Use .lean() for faster, plain JavaScript object results

  // If no document is found or it has no topics, return an empty array
  if (!recommendationDoc || !recommendationDoc.recomendedTopics) {
    return [];
  }

  // Return the populated array of topics
  return recommendationDoc.recomendedTopics;
};