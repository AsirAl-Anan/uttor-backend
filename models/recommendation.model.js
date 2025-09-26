import { academicDb } from "../config/db.js";

import mongoose from "mongoose";

const recommendationSchema = new mongoose.Schema(
  {
    userId: {
    type: String  // only string because the user is from userDb
    },
    recomendedTopics:[
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Topic",
            required: true,
        }
    ]
  },
  { timestamps: true }
);

const Recommendation = academicDb.model("Recommendation", recommendationSchema);

export default Recommendation;