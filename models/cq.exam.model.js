import { academicDb } from "../config/db.js";
import mongoose from "mongoose";

const attemptSchema = new mongoose.Schema({
    userId: {
        type: String, // Storing as String because User model is in a different DB
        required: true,
    },
    startTime: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['in-progress', 'completed'],
        required: true,
    },
    endTime: {
        type: Date,
    }
}, { _id: false }); // _id is not needed for subdocuments here

const cqExamSchema = new mongoose.Schema({
    isEvaluated:{
        type: Boolean,
        default: false,
    },
    questions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "CreativeQuestion",
        required: true
    }],
    creator: {
        type: String,
        
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    title: {
        type: String,
        required: [true, "Exam title is required"],
        trim: true,
    },
    duration: {
        type: Number,
        required: true,
    },
    source: {
        type: String,
        required: true,
        enum: ["database", "ai"]
    },
    chapter: { //new
        index:{
            type: Number,
            required: true,
        },
        name: { type: String, required: true },

    },
    subject: {
        code: { type: Number, required: true },
        id: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true }, //new

    },
    // Add the attempts array here
    attempts: [attemptSchema],
    
}, { timestamps: true });

export const CqExam = academicDb.model("CqExam", cqExamSchema);