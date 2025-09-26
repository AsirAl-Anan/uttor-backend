// models/userActivity.model.js
import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const userActivitySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    activityType: {
        type: String,
        enum: ['login', 'exam_submitted'],
        required: true,
    },
    details: {
        examId: mongoose.Schema.Types.ObjectId,
        examType: { type: String, enum: ['cq', 'mcq'] },
        message: String,
    }
}, { timestamps: true });

export const UserActivity = userDb.model('UserActivity', userActivitySchema);