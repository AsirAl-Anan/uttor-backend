// models/mcq.result.model.js
import { academicDb } from "../config/db.js";
import mongoose from "mongoose";

// Stores the result of a single question
const answerResultSchema = new mongoose.Schema({
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    },
    selectedOption: {
        type: String,
        required: true,
    },
    isCorrect: {
        type: Boolean,
        required: true,
    }
}, { _id: false });

const mcqResultSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "McqExam",
        required: true,
    },
    userId: {
        type: String, // Storing as String because User model is in a different DB
        required: true,
    },
    score: {
        type: Number,
        required: true,
    },
    totalMarks: {
        type: Number,
        required: true,
    },
    answers: [answerResultSchema], // Detailed breakdown of each answer
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    auraChange: { 
    type: Number, 
    default: 0 
},
auraMessageSeen: { 
    type: Boolean, 
    default: false 
},
}, {
    timestamps: true
});

export const McqResult = academicDb.model("McqResult", mcqResultSchema);