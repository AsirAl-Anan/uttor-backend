import mongoose from "mongoose";
import {academicDb} from "../config/db";
const subjectSchema = new mongoose.Schema({
  englishName: { type: String, required: true },
  banglaName: { type: String, required: true },
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
        englishName: { type: String, trim: true, required: true },
        banglaName: { type: String, required: true },
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
});

const Subject = academicDb.model("Subject", subjectSchema);

export default Subject;
