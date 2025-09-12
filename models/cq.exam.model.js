import { userDb } from "../config/db";
import mongoose from "mongoose";

const cqExamSchema = new mongoose.Schema({
    questions:[]
})