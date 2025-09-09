import mongoose, { Schema } from "mongoose";
import { academicDb } from "../config/db.js";
const questionEmbeddingSchame = new Schema({
    creativeQuestionId: {  // for creative question of b1,chem,hm,phy and others
        type: mongoose.Schema.Types.ObjectId, 
        ref: "CreativeQuestion", 
        default: null
    },
    b2QuestionId: {  // only for b2 question 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "B2Question", 
        default: null
    },

    embedding: { 
        type: [Number], // vector array
        required: true 
    }
}, { timestamps: true });

const QuestionEmbedding  =  academicDb.model("QuestionEmbedding", questionEmbeddingSchame);

export default QuestionEmbedding;
