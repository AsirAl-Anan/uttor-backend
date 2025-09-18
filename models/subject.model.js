import mongoose from "mongoose";
import {academicDb} from "../config/db.js";
//old schema
// const subjectSchema = new mongoose.Schema({
//   englishName: { type: String, required: true },
//   banglaName: { type: String, required: true },
//   subjectCode: { type: Number, required: true },
//   aliases: {
//     english: [{ type: String }],
//     bangla: [{ type: String }],
//     banglish: [{ type: String }],
//   },
//   level: {
//     type: String,
//     enum: ["SSC", "HSC"],
//     required: true,
//   },
//   group: {
//     type: String,
//     enum: ["science", "arts", "commerce"],
//     required: true,
//   },
//   chapters: {
//     type: [
//       { 
//         englishName: { type: String, trim: true, required: true },
//         banglaName: { type: String, required: true },
//         topics: [
//          {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "Topic",
//          }  
//         ],
//       },
//     ],
//     required: true,
//   },
// });
//new schema
const subjectSchema = new mongoose.Schema({
  linkingId: { type: String, required: true },
  version: { type: String, enum: ['english', 'bangla'], required: true },
  name: { type: String, required: true }, // Replaces englishName/banglaName
  subjectCode: { type: Number, required: true },
  aliases: {
    english: [{ type: String }],
    bangla: [{ type: String }],
    banglish: [{ type: String }],
  },
  level: {
    type: String,
    enum: ["SSC", "HSC"],
    required: true,
  },
  group: {
    type: String,
    enum: ["science", "arts", "commerce"],
    required: true,
  },
  chapters: {
    type: [
      { 
        name: { type: String, trim: true, required: true }, // Replaces englishName/banglaName
         aliases: {
    english: [{ type: String }],
    bangla: [{ type: String }],
    banglish: [{ type: String }],
  },
        topics: [
         {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Topic",
         }  
        ],
      },
    ],
    required: true,
  },
}, { timestamps: true });


const Subject = academicDb.model("Subject", subjectSchema);

export default Subject;
