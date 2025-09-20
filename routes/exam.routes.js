import { Router } from "express";
import { configurations } from "../utils/multer.js";
import { authenTicateSession } from "../middlewares/auth.js";
import { startEvaluation } from "../controllers/evaluation.controller.js";

// Import all the controller functions for exams
import {
    getAllExams,
    getAllCqExam,
    getAllMcqExam,
    getCqExamById,
    getMcqExamById,
    createCqExam,
    createMcqExam
} from "../controllers/exam.controller.js";
import {createExam} from "../services/tools/exam.tool.js";

const router = Router();

// Apply session authentication to all routes defined in this file.
// Every endpoint below will require a valid session.
router.use(authenTicateSession);


//================================//
//      EXAM MANAGEMENT ROUTES    //
//================================//

/**
 * @route   GET /api/exams
 * @desc    Get all exams (both MCQ and CQ combined)
 * @access  Private (Authenticated User)
 */
router.get('/', getAllExams);


// --- Creative Question (CQ) Exam Routes ---

/**
 * @route   GET /api/exams/cq
 * @desc    Get all CQ exams
 * @access  Private (Authenticated User)
 * 
 * @route   POST /api/exams/cq
 * @desc    Create a new CQ exam
 * @access  Private (Authenticated User - potentially Admin/Creator role)
 */
router.route('/cq')
    .get(getAllCqExam)
    .post(createExam);

/**
 * @route   GET /api/exams/cq/:id
 * @desc    Get a single CQ exam by its ID
 * @access  Private (Authenticated User)
 */
router.get('/cq/:id', getCqExamById);


// --- Multiple Choice (MCQ) Exam Routes ---

/**
 * @route   GET /api/exams/mcq
 * @desc    Get all MCQ exams
 * @access  Private (Authenticated User)
 * 
 * @route   POST /api/exams/mcq
 * @desc    Create a new MCQ exam
 * @access  Private (Authenticated User - potentially Admin/Creator role)
 */
router.route('/mcq')
    .get(getAllMcqExam)
    .post(createMcqExam);

/**
 * @route   GET /api/exams/mcq/:id
 * @desc    Get a single MCQ exam by its ID
 * @access  Private (Authenticated User)
 */
router.get('/mcq/:id', getMcqExamById);


//================================//
//      EVALUATION ROUTES         //
//================================//

/**
 * @route   POST /api/exams/evaluate
 * @desc    Start the evaluation process for an exam (existing route)
 * @access  Private (Authenticated User)
 */
router.post('/evaluate', configurations.any, startEvaluation);


export default router;