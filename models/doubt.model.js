// models/doubt.model.js
import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const doubtSchema = new mongoose.Schema({
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    title: {
        type: String,
        required: true,
        trim: true,
    },
    body: {
        type: String,
        required: true,
    },
    images: [{
        publicId: { type: String, required: true },
        url: { type: String, required: true },
    }],
    tags: [{
        type: String, // Storing tags as lowercase strings for simplicity
        lowercase: true,
        trim: true,
    }],
    subject: { type: String, trim: true },
    chapter: { type: String, trim: true },
    upvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    downvotes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    voteScore: {
        type: Number,
        default: 0,
        index: true,
    },
    answers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Answer'
    }],
    bestAnswer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Answer',
        default: null,
    }
}, { timestamps: true });

doubtSchema.index({ title: 'text', body: 'text' }); // For full-text search later

export const Doubt = userDb.model('Doubt', doubtSchema);