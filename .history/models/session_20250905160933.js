import { Schema } from 'mongoose';
import userDb from '../server.js'; // To register model on correct DB

const sessionSchema = new Schema({
  _id: String,
  session: Object,
  expires: Date
}, { collection: 'sessions' });

export default userDb.model('Session', sessionSchema);