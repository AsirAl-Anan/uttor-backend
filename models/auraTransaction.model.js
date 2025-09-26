// models/auraTransaction.model.js
import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const auraTransactionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    points: {
        type: Number,
        required: true, // Can be positive or negative
    },
    source: {
        type: {
            type: String,
            enum: [
                'mcq_result', 
                'cq_result',
                // --- NEW HUB SOURCES ---
                'doubt_upvote',
                'doubt_downvote',
                'answer_upvote',
                'answer_downvote'
            ],
            required: true,
        },
        id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        }
    },
    reason: {
        type: String,
        required: true,
    }
}, { timestamps: true });

export const AuraTransaction = userDb.model('AuraTransaction', auraTransactionSchema);