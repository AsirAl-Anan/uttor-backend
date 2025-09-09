import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const preferencesSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    unique: true 
  },
  theme: { 
    type: String, 
    enum: ["light", "dark"], 
    default: "light" 
  },
  preferredLanguage: { 
    type: String, 
    enum: ["Bangla", "English"], 
    default: "Bangla" 
  },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: false },
  },
}, { timestamps: true });

// Ensure user reference is populated
preferencesSchema.pre(/^find/, function(next) {
  this.populate('user');
  next();
});

const Preferences = userDb.model('Preferences', preferencesSchema);
export default Preferences;