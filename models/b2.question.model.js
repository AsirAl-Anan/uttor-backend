import mongoose from "mongoose";
import { academicDb } from "../config/db";
const b2QuestionSchema = new mongoose.Schema(
    {
        questionNumber: { // The main question number (e.g., 1, 2, 3...)
            type: Number,
            required: true
        },
        question:{
            questiontext:{
               type:String 
               
            },
            identifier:{ // For sub-parts like 'ক', 'খ', or 'i', 'ii' if applicable
                type: String,
                required: true
            },
          
        },
    
        section: { // e.g., 'ব্যাকরণ অংশ', 'নির্মিতি অংশ'
            type: String,
            required: true,
            enum: ['ব্যাকরণ অংশ', 'নির্মিতি অংশ', 'Others'] // Added 'Others' for flexibility
        },
        topic: { // Main subject area (e.g., 'বানান', 'সমাস', 'প্রবন্ধ/রচনা', 'সারাংশ')
            type: String,
            required: true
        },
       questionType: { // e.g., 'uccharon er niyom lekho, jekono 5ti banan suddho koro
            type: String,
            required: true,
        },

     
        
       
      

        // 4. Metadata
        marks: {
            type: Number,
            required: true
        },
       
        groupRef: { // A unique ID to link all questions that are part of the same 'অথবা' group
            type: String,
            default: null
        },
       
        boards: [{ // List of specific board exams this question (or a similar version) appeared in (e.g., ['Dhaka 2023', 'Rajshahi 2022'])
           board:{
            type: String,
           },
           year:{
            type: Number,
           }
        }],
     
        insitution:{
            name:{ type: String, default: null},
            year:{ type: Number, default: null},
            type:{ type: String, default: null} //year final, mt etc
        },
        
        aliases: [{ // Additional keywords for searching or categorization (e.g., 'vocabulary', 'prose', 'poetry')
            type: String
        }],
    },
    { timestamps: true } // Adds createdAt and updatedAt fields automatically
);

const b2Question = academicDb.model("b2Question", b2QuestionSchema);

export default b2Question;