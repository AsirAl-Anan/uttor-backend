import {userDb} from "../config/db.js";
import mongoose from "mongoose";


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
    // Metadata specific to Bangladeshi context
    level: {
        type: String,
        enum: ['SSC', 'HSC'],
        required: true,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    chapter: {
        type: String,
        required: true,
        trim: true,
    },
    board: {
        type: String,
        enum: ['All', 'Dhaka', 'Rajshahi', 'Cumilla', 'Jashore', 'Chattogram', 'Barishal', 'Sylhet', 'Dinajpur', 'Mymensingh', 'Technical', 'Madrassah'],
        default: 'All'
    },
    // Exam rules
    totalMarks: {
        type: Number,
        required: true,
    },
    timeLimitInMinutes: {
        type: Number,
        required: [true, "Time limit is required"],
    },
    // The core of the exam
    questions: [
        {
            questionText: {
                type: String,
                required: true
            },
            questionImage: { // Optional: for questions with diagrams (Physics, Biology)
                type: String, 
                default: null
            },
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
                    optionImage: { // Optional: for options with diagrams (Physics, Biology)
                        type: String, 
                        default: null
                    },
                    optionIdentifier:{
                        type: String,
                        required: true,
                        enum: ['a', 'b', 'c', 'd', 'e','f', 'g', 'h', 'i', 'j']
                    }
                }
            ],
            explanation: { // Optional: To show the user after they complete the exam
                type: String,
                default: ''
            },
            marks: {
                type: Number,
                default: 1
            }
        }
    ],
    creator: { // The teacher/admin who created the exam
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    isActive: { // To control if students can take this exam
        type: Boolean,
        default: true,
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});


// To ensure each question has exactly one correct answer (optional but good practice)
mcqExamSchema.path('questions').validate(function(questions) {
    if (!questions) return false;
    for (const question of questions) {
        const correctOptions = question.options.filter(opt => opt.isCorrect);
        if (correctOptions.length !== 1) {
            return false; // Validation fails if there is not exactly one correct option
        }
    }
    return true;
}, 'Each question must have exactly one correct answer.');


const McqExam = userDb.model("McqExam", mcqExamSchema);

export default McqExam;