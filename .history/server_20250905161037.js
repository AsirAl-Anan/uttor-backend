import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app.js";

dotenv.config();

// Connect to user database
const userDb = mongoose.createConnection(process.env.MONGODB_URI_USER);
userDb.on("error", console.error.bind(console, "User DB connection error:"));
userDb.once("open", () => console.log("Connected to User Database"));

// Connect to academic database
const academicDb = mongoose.createConnection(process.env.MONGODB_URI_ACADEMIC);
academicDb.on("error", console.error.bind(console, "Academic DB connection error:"));
academicDb.once("open", () => console.log("Connected to Academic Database"));

// Export DB connections for models
export { userDb, academicDb };

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});