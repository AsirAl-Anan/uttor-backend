// models/tag.model.js
import mongoose from 'mongoose';
import { userDb } from '../config/db.js';

const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
    },
    doubtCount: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

tagSchema.index({ name: 'text' }); // For text search

export const Tag = userDb.model('Tag', tagSchema);