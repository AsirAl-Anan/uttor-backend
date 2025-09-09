import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const sessionSchema = new mongoose.Schema({
  _id: String,
  session: Object,
  expires: Date
}, { 
  collection: 'sessions',
  timestamps: true 
});

const Session = userDb.model('Session', sessionSchema);
export default Session;