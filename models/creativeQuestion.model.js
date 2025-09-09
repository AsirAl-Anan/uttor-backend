// models/CreativeQuestion.js
import mongoose from "mongoose";
import { academicDb } from "../config/db.js";
// Constants for enums
const BOARDS = [
  'Dhaka', 'Rajshahi', 'Chittagong', 
  'Sylhet', 'Comilla', 'Jessore', 'Dinajpur',
  'Mymensingh', 'Madrasah', 'Barishal'
];
const GROUPS = ['science', 'arts', 'commerce'];
const LEVELS = ['SSC', 'HSC'];
const VERSIONS = ['Bangla', 'English'];
const DIFFICULTIES = ['easy', 'medium', 'hard'];

const creativeQuestionSchema = new mongoose.Schema({
    linkingId: {  
    type: String,
    required: true,
  },

  stem: { type: String, required: true },
  stemImage: { type: String }, // optional image for question stem

  // Question options
  a: { type: String, required: true },
  aAnswer: { type: String, required: true },

  b: { type: String, required: true },
  bAnswer: { type: String, required: true },

  c: { type: String, required: true },
  cAnswer: { type: String, required: true },
  cQuestionType:{ type: String, required: true },
  dQuestionType:{ type: String, required: true },
  cAnswerImage: { type: String }, // optional
  cTopic: {
    topicId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Topic' }, 
    englishName: { type: String, required: true },
    banglaName: { type: String, required: true },
  },
  cType: { type: String }, // optional sub-type

  d: { type: String }, // optional
  dAnswer: { type: String }, // required only if 'd' exists
  dAnswerImage: { type: String }, // optional
  dTopic: {
    topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' }, // required only if 'd' exists
    englishName: { type: String },
    banglaName: { type: String },
  },
  dType: { type: String }, // optional sub-type

  group: { type: String, enum: GROUPS, required: true },
  board: { type: String, enum: BOARDS },
  institution: { name:{type: String}, examType: {type: String} }, // optional
  year: { type: Number, required: true, min: 2000, max: 2099 },

  subject: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  level: { type: String, enum: LEVELS, required: true },
  version: { type: String, enum: VERSIONS, required: true },

  chapter: {
    chapterId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Chapter' },
    englishName: { type: String, required: true },
    banglaName: { type: String, required: true },
  }

}, { timestamps: true });

// Add a pre-save hook to ensure dTopic, dSubTopic and dAnswer are required if 'd' is provided
// creativeQuestionSchema.pre('save', function (next) {
//   if (this.d) {
//     if (!this.dTopic || !this.dTopic.topicId) {
//       return next(new Error("dTopic.topicId is required when 'd' field is provided."));
//     }
//     if (!this.dAnswer) {
//       return next(new Error("dAnswer is required when 'd' field is provided."));
//     }
//     // dSubTopic is optional, so no check needed for its existence or fields
//   }
//   next();
// });

// // Add a pre-validate hook to ensure dTopic and cTopic details are provided
// creativeQuestionSchema.pre('validate', function (next) {
//   // Validate cTopic always
//   if (!this.cTopic || !this.cTopic.topicId || !this.cTopic.englishName || !this.cTopic.banglaName) {
//     return next(new Error("cTopic.topicId, cTopic.englishName, and cTopic.banglaName are required."));
//   }

//   // Validate dTopic details if 'd' exists
//   if (this.d && (!this.dTopic || !this.dTopic.englishName || !this.dTopic.banglaName)) {
//     return next(new Error("dTopic englishName and banglaName are required when 'd' field is provided."));
//   }

//   // Validate cSubTopic details if cSubTopic exists (i.e., topicId is present)
//   if (this.cSubTopic && this.cSubTopic.topicId) {
//     if (!this.cSubTopic.englishName || !this.cSubTopic.banglaName) {
//       return next(new Error("If cSubTopic.topicId is provided, cSubTopic.englishName and cSubTopic.banglaName are required."));
//     }
//   }

//   // Validate dSubTopic details if dSubTopic exists (i.e., topicId is present)
//   if (this.d && this.dSubTopic && this.dSubTopic.topicId) {
//     if (!this.dSubTopic.englishName || !this.dSubTopic.banglaName) {
//       return next(new Error("If dSubTopic.topicId is provided, dSubTopic.englishName and dSubTopic.banglaName are required."));
//     }
//   }

//   next();
// });

// Optional: Add indexes for better query performance on frequently searched fields like topic IDs
// creativeQuestionSchema.index({ 'cTopic.topicId': 1 });
// creativeQuestionSchema.index({ 'dTopic.topicId': 1 });
// creativeQuestionSchema.index({ 'cSubTopic.topicId': 1 });
// creativeQuestionSchema.index({ 'dSubTopic.topicId': 1 });

const CreativeQuestion = academicDb.model('CreativeQuestion', creativeQuestionSchema);
export default CreativeQuestion;
