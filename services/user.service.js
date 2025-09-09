import User from '../models/User.js';
import Preferences from '../models/preferences.js';
import { Chat } from '../models/chat.model.js';
import { Message } from '../models/message.model.js';
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
