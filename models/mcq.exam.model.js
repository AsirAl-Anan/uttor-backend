import { academicDb } from "../config/db.js";
import mongoose from "mongoose";

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
            optionImage: { // Optional: for options with diagrams
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
    explanation: { // Optional: explanation for user
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
        enum: ['SSC', 'HSC'],
        required: true,
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subject",
        required: true,
        
    },
    chapterIndex: {
        type: Number,
        required: true,
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
    questions: [mcqSchema], // ✅ embed mcqSchema here
    creator: {
     type: String,
     required: true,
    },
    isActive: {
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true
});

// ✅ Validation: ensure exactly one correct option
mcqExamSchema.path('questions').validate(function (questions) {
    if (!questions) return false;
    for (const question of questions) {
        const correctOptions = question.options.filter(opt => opt.isCorrect);
        if (correctOptions.length !== 1) {
            return false;
        }
    }
    return true;
}, 'Each question must have exactly one correct answer.');
export const MCQ = academicDb.model("MCQ", mcqSchema);

const McqExam = academicDb.model("McqExam", mcqExamSchema);

export default McqExam;
