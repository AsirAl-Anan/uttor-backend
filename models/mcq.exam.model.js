// models/mcq.exam.model.js
import { academicDb } from "../config/db.js";
import mongoose from "mongoose";

const mcqAttemptSchema = new mongoose.Schema({
    userId: {
        type: String,
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
    answers: {
        type: Map,
        of: String,
        default: {}
    },
    endTime: {
        type: Date,
    }
}, { _id: false });

const mcqSchema = new mongoose.Schema({
    questionText: {
        type: String,
        required: true
    },
    questionImages: [
        {
            image: {
                type: String,
                required: true
            },
            caption: {
                type: String,
                default: ''
            }
        }
    ],
    options: [
        {
            optionText: {
                type: String,
                required: true
            },
            isCorrect: {
                type: Boolean,
                required: true,
                default: false
            },
            optionImage: {
                type: String,
                default: null
            },
            optionIdentifier: {
                type: String,
                required: true,
                enum: ['a', 'b', 'c', 'd', 'e','f', 'g', 'h', 'i', 'j']
            }
        }
    ],
    explanation: {
        type: String,
        default: ''
    },
    marks: {
        type: Number,
        default: 1
    }
});

const mcqExamSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, "Exam title is required"],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    level: {
        type: String,
    },
    subject: {
        id: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Subject", 
            required: true 
        },
    },
    chapter: {
        name: {
            type: String,
            required: true,
        },
        index: {
            type: Number,
            required: true,
        }
    },
    board: {
        type: String,
        enum: ['All', 'Dhaka', 'Rajshahi', 'Cumilla', 'Jashore', 'Chattogram', 'Barishal', 'Sylhet', 'Dinajpur', 'Mymensingh', 'Technical', 'Madrassah'],
        default: 'All'
    },
    totalMarks: {
        type: Number,
        required: true,
    },
    timeLimitInMinutes: {
        type: Number,
        required: [true, "Time limit is required"],
    },
    questions: [mcqSchema],
    creator: {
        type: String,
        required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    source: {
        type: String,
        required: true,
        enum: ["database", "ai"]
    },
    // ======================== THE FIX ========================
    attempts: {
        type: [mcqAttemptSchema],
        default: [] // Ensure this field always exists, even if empty.
    }
    // ========================================================
}, {
    timestamps: true
});

mcqExamSchema.path('questions').validate(function (questions) {
    if (!questions || questions.length === 0) return false;
    for (const question of questions) {
        const correctOptions = question.options.filter(opt => opt.isCorrect);
        if (correctOptions.length !== 1) {
            return false;
        }
    }
    return true;
}, 'Each question must have exactly one correct answer and there must be at least one question.');

export const MCQ = academicDb.model("MCQ", mcqSchema);
const McqExam = academicDb.model("McqExam", mcqExamSchema);
export default McqExam;