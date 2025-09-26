// models/answer.model.js
import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const answerSchema = new mongoose.Schema({
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    doubt: { type: mongoose.Schema.Types.ObjectId, ref: 'Doubt', required: true, index: true },
    body: { type: String, required: true },
    
    // --- NEW FIELD FOR IMAGES ---
    images: [{
        publicId: { type: String, required: true },
        url: { type: String, required: true },
    }],

    // --- NEW FIELD FOR HIERARCHY ---
    // This will be null for top-level answers and contain an ID for replies.
    parentAnswer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Answer',
        default: null,
        index: true,
    },

    // --- EXISTING FIELDS ---
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    downvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    voteScore: { type: Number, default: 0 },
    replies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Answer' }],
}, { timestamps: true });

export const Answer = userDb.model('Answer', answerSchema);