import { academicDb } from "../config/db.js";
import mongoose from "mongoose";

const cqAnswerEvaluationSchema = new mongoose.Schema({
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "CreativeQuestion", required: true },
    answerReport: { type: String }, // Made optional, as it might be generated post-evaluation
    originalImages: {
        type: [String],
        required: true,
        validate: [ (val) => val.length > 0, 'At least one answer image is required.' ]
    },
        userId: { type: String, required: true, index: true },
    examId: { type:mongoose.Schema.Types.ObjectId, ref: "CqExam", required: true, index: true },
    evaluatedImages: { type: [String] },
    marksObtained: { type: Number, default: 0 },
    marksA: { type: Number, default: 0, min: 0, max: 1 },
    marksB: { type: Number, default: 0, min: 0, max: 2 },
    marksC: { type: Number, default: 0, min: 0, max: 3 },
    marksD: { type: Number, default: 0, min: 0, max: 4 },
    handWriting: { type: String, enum:['Excellent', 'Good', 'Average', 'Poor'] },
    feedbackA:{
        type: String,   //feed back for storing the full correction and explation for why the mark is cut and what the student did wrong vs the correct answer

    },
     feedbackB:{
        type: String,

    },
     feedbackC:{
        type: String,

    },
     feedbackD:{
        type: String,

    },
    totalMarks: { type: Number, required: true },
    feedback: { type: String },
    rawAnnotations: { type: mongoose.Schema.Types.Mixed },
    // RECOMMENDED ADDITION: AI confidence score
    evaluationConfidence: { type: Number, min: 0, max: 1 },
});

const cqResultSchema = new mongoose.Schema({
    examId: { type: mongoose.Schema.Types.ObjectId, ref: "CqExam", required: true, index: true },
    userId: { type: String, required: true, index: true },
    answers: [cqAnswerEvaluationSchema],
    status: {
        type: String,
        enum: ['submitted', 'evaluating', 'evaluated', 'error', 'review_required'],
        default: 'submitted',
        required: true,
    },
    totalMarksObtained: { type: Number, default: 0 },
    evaluatedBy: { type: String, enum: ['ai', 'human'], default: 'ai' },
    evaluatedAt: { type: Date },
    feedback: { type: String }, // Overall exam feedback
    // RECOMMENDED ADDITIONS: For maintenance and debugging
    aiModelVersion: { type: String },
    errorMessage: { type: String },
}, { timestamps: true });

// RECOMMENDED ADDITION: Hook for data integrity
cqResultSchema.pre('save', function(next) {
    // Check if the answers array is modified to avoid unnecessary recalculations
    if (this.isModified('answers')) {
        let overallTotal = 0;
        this.answers.forEach(answer => {
            const answerTotal = (answer.marksA || 0) + (answer.marksB || 0) + (answer.marksC || 0) + (answer.marksD || 0);
            answer.marksObtained = answerTotal;
            overallTotal += answerTotal;
        });
        this.totalMarksObtained = overallTotal;
    }
    next();
});
export const AnswerEvaluation = academicDb.model("AnswerEvaluation", cqAnswerEvaluationSchema);
export const CqResult = academicDb.model("CqResult", cqResultSchema);