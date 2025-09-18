import User from '../models/User.js';
import Preferences from '../models/preferences.js';
import { Chat } from '../models/chat.model.js';
import { Message } from '../models/message.model.js';
import { CqExam } from '../models/cq.exam.model.js';
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
  if (chat) {
    chat.messages = messages;
  }
  return chat;
  // return messages;
}

export const getCqExam = async (examId) => {
  // Find the exam by its ID and use .populate() to fetch the full question documents.
  // This replaces the array of ObjectIds in the 'questions' field with the actual question data.
  return await CqExam.findById(examId).populate('questions');
}
/**
 * Gets an exam and the user's attempt status for it.
 * @param {string} examId
 * @param {string} userId
 */
export const getExamAndAttempt = async (examId, userId) => {
    // We use lean() for performance, as we will modify the object.
    const exam = await CqExam.findById(examId).populate('questions').lean();
    if (!exam) {
        throw new Error('Exam not found');
    }

    // Find the specific attempt for this user within the exam document
    const attempt = exam.attempts.find(a => a.userId === userId.toString());

    // Logic to control data visibility
    if (!attempt) {
        // If no attempt, don't send questions (pre-start view)
        delete exam.questions;
    } else if (attempt.status !== 'completed') {
        // If in-progress, send questions but strip out the answers
        exam.questions?.forEach(q => {
            delete q.aAnswer;
            delete q.bAnswer;
            delete q.cAnswer;
            delete q.dAnswer;
            delete q.cAnswerImage;
            delete q.dAnswerImage;
        });
    }
    // If completed, the full question objects (with answers) are sent.

    return { exam, attempt: attempt || null };
};

/**
 * Starts an exam attempt for a user.
 * @param {string} examId
 * @param {string} userId
 */
export const startExamAttempt = async (examId, userId) => {
    const exam = await CqExam.findById(examId);
    if (!exam || !exam.isActive) {
        throw new Error('This exam is not available or no longer active');
    }

    // Check if an attempt already exists for this user
    const existingAttempt = exam.attempts.find(a => a.userId === userId.toString());
    if (existingAttempt) {
        throw new Error('You have already started this exam');
    }

    const newAttempt = {
        userId: userId.toString(),
        startTime: new Date(),
        status: 'in-progress',
    };

    // Atomically push the new attempt to the array
    await CqExam.findByIdAndUpdate(examId, {
        $push: { attempts: newAttempt }
    });

    return newAttempt;
};

/**
 * Finishes an exam attempt for a user.
 * @param {string} examId
 * @param {string} userId
 */
export const finishExamAttempt = async (examId, userId) => {
    const exam = await CqExam.findOneAndUpdate(
        { 
            _id: examId, 
            'attempts.userId': userId.toString(),
            'attempts.status': 'in-progress'
        },
        { 
            $set: { 
                'attempts.$[elem].status': 'completed',
                'attempts.$[elem].endTime': new Date(),
            }
        },
        { 
            arrayFilters: [{ 'elem.userId': userId.toString() }],
            new: true // return the updated document
        }
    );

    if (!exam) {
        throw new Error('No active exam attempt found to finish.');
    }

    return exam.attempts.find(a => a.userId === userId.toString());
};