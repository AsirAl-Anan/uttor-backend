import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true },
    displayName: { type: String },
    email: { type: String, required: true, unique: true, trim: true },

    username: { type: String, unique: true, sparse: true, trim: true },
    nickname: { type: String, trim: true },

    level: { type: String, enum: ["SSC", "HSC"] },
    version: { type: String, enum: ["Bangla", "English"] },
    group: { type: String, enum: ["Science", "Business Studies", "Humanities"] },
    board: {
      type: String,
      enum: ["Dhaka","Chattogram","Rajshahi","Khulna","Barishal","Sylhet","Comilla","Dinajpur","Mymensingh"]
    },
    institution: { type: String, trim: true },
    sscYear: { type: Number, min: 2000, max: 2100 },
    hscYear: { type: Number, min: 2000, max: 2100 },

    preferences: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Preferences",
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);