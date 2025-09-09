import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const userSchema = new mongoose.Schema({
  googleId: { type: String, unique: true, sparse: true },
  displayName: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  avatar: { type: String },

  // Profile completion fields
  username: { 
    type: String, 
    unique: true, 
    sparse: true, 
    trim: true,
    validate: {
      validator: function(v) {
        return !v || v.length >= 3;
      },
      message: 'Username must be at least 3 characters long'
    }
  },
  nickname: { type: String, trim: true },

  // Academic information
  level: { type: String, enum: ["SSC", "HSC"] },
  version: { type: String, enum: ["Bangla", "English"] },
  group: { type: String, enum: ["Science", "Business Studies", "Humanities"] },
  board: { 
    type: String, 
    enum: ["Dhaka","Chattogram","Rajshahi","Khulna","Barishal","Sylhet","Comilla","Dinajpur","Mymensingh"]
  },
  institution: { type: String, trim: true },
  sscYear: { type: Number, min: 2000, max: new Date().getFullYear() + 5 },
  hscYear: { type: Number, min: 2000, max: new Date().getFullYear() + 5 },

  preferences: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Preferences",
  },

  isProfileComplete: { type: Boolean, default: false }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for checking if profile is complete
userSchema.virtual('profileStatus').get(function() {
  return this.isProfileComplete ? 'complete' : 'incomplete';
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });

const User = userDb.model('User', userSchema);
export default User;