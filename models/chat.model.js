// models/Chat.js
import mongoose from "mongoose";
import { userDb } from "../config/db.js";

const chatSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // reference to your user model
      required: true,
    },
    title: {
      type: String,
      default: "New Chat",
    },
    messages: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Message",
      },
    ],
  },
  { timestamps: true }
);

export const Chat = userDb.model("Chat", chatSchema);
