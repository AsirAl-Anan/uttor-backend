import mongoose from "mongoose";

const preferencesSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    theme: { type: String, enum: ["light", "dark"], default: "light" },
    preferredLanguage: { type: String, enum: ["Bangla", "English"], default: "Bangla" },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Preferences", preferencesSchema);