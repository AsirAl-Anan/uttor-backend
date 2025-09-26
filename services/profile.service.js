import User from '../models/User.js';
import Preferences from '../models/preferences.js';
import {Chat} from '../models/chat.model.js';
export const checkUsernameExists = async (username, excludeUserId = null) => {
  const query = { username };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  return await User.findOne(query);
};

export const updateUserProfile = async (userId, updateData) => {
  // Check if username is unique
  if (updateData.username) {
    const existingUser = await checkUsernameExists(updateData.username, userId);
    if (existingUser) {
      throw new Error('Username already taken');
    }
  }

  // Update user profile
  const user = await User.findByIdAndUpdate(
    userId, 
    { ...updateData, isProfileComplete: true },
    { new: true, runValidators: true }
  ).populate('preferences');

  return user;
};

export const getUserProfile = async (userId) => {
  
  return await User.findById(userId).populate('preferences').select(' -__v -createdAt -updatedAt ');
};

export const updatePreferences = async (userId, preferencesData) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  if (!user.preferences) {
    // Create preferences if they don't exist
    const preferences = await Preferences.create({ 
      user: userId, 
      ...preferencesData 
    });
    user.preferences = preferences._id;
    await user.save();
    return await Preferences.findById(preferences._id);
  } else {
    // Update existing preferences
    return await Preferences.findByIdAndUpdate(
      user.preferences, 
      preferencesData, 
      { new: true }
    );
  }
};
export const getUserChats = async (userId) => {
const user = await User.findById(userId)
  if (!user) {
    throw new Error('User not found');
  }
  const chats = await Chat.find({ user: userId }).populate('messages').select('-__v ');
  
  return chats;

}
