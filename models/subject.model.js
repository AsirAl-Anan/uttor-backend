import mongoose from "mongoose";
import {academicDb} from "../config/db.js";

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
        name: { type: String, required: true }, 
        subjectIndex: { type: Number, required: true },//new field //starts from one
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
