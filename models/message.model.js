// models/Message.js
import mongoose from "mongoose";
import { userDb } from "../config/db.js";

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: String,
      enum: ["user", "ai"], // who sent the message
      required: true,
    },
    content: {
     text:{
        type: String,
        required: true,
     },
        images: {
          type: [String],
          default: [],
        },
         audio:{
      type: String,
      default: null
    }  
    },
   
    },
  { timestamps: true }
);

export const Message = userDb.model("Message", messageSchema);
