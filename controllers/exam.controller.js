import mongoose from 'mongoose';
import McqExam, { MCQ } from '../models/mcq.exam.model.js'; // Assuming MCQ is exported from here too
import { CqExam } from '../models/cq.exam.model.js';
import CreativeQuestion from '../models/creativeQuestion.model.js';
import User from '../models/User.js'; // This model uses the 'userDb' connection

// --- Helper Function for Cross-Database Population ---

/**
 * Manually populates the 'creator' field for an array of exams.
 * Mongoose's .populate() cannot work across different database connections.
 * @param {Array<Object>} exams - An array of exam documents (from academicDb).
 * @returns {Promise<Array<Object>>} - The array of exams with creator info populated from userDb.
 */
const populateCreators = async (exams) => {
    if (!exams || exams.length === 0) {
        return [];
    }

    // 1. Get all unique creator IDs from the exams
    // Using a Set is an efficient way to ensure uniqueness.
    const creatorIds = [...new Set(exams.map(exam => exam.creator))];

    if (creatorIds.length === 0) {
        return exams; // Return original if no creators to populate
    }

    // 2. Fetch all corresponding users from the 'userDb' in a single query
    const creators = await User.find({ _id: { $in: creatorIds } })
        .select('name displayName email avatar createdAt') // Select only the fields you need
        .lean(); // .lean() for better performance as we don't need Mongoose documents

    // 3. Create a map for quick lookup (ID -> User Object)
    const creatorMap = creators.reduce((map, user) => {
        // Mongoose _id is an object, so convert to string for the map key
        map[user._id.toString()] = user;
        return map;
    }, {});

    // 4. Map through the original exams and replace the creator ID with the full user object
    const populatedExams = exams.map(exam => {
        const creatorInfo = creatorMap[exam.creator];
        return {
            ...exam,
            creator: creatorInfo || { name: 'Unknown or Deleted User' } // Fallback for safety
        };
    });

    return populatedExams;
};


// --- GET Functions ---

/**
 * @desc    Get all MCQ and CQ exams, sorted by creation date
 * @route   GET /api/exams
 * @access  Public (or Protected)
 */
export const getAllExams = async (req, res) => {
    try {
        // Fetch both exam types concurrently for better performance
        const mcqExamsPromise = McqExam.find({})
            .populate('subject', 'name code') // Populate subject from academicDb
            .sort({ createdAt: -1 })
            .lean();

        const cqExamsPromise = CqExam.find({})
            // CQ Exam subject is not a ref, so no populate needed here based on schema
            .populate({
                path: 'questions',
                select: 'stem subject chapter level', // select fields from CreativeQuestion
                populate: [ // nested population
                    { path: 'subject', select: 'name code' },
                    { path: 'chapter.chapterId', select: 'englishName' }
                ]
            })
            .sort({ createdAt: -1 })
            .lean();
            
        let [mcqExams, cqExams] = await Promise.all([mcqExamsPromise, cqExamsPromise]);

        // Add a 'type' field to distinguish them on the frontend
        mcqExams = mcqExams.map(exam => ({ ...exam, examType: 'MCQ' }));
        cqExams = cqExams.map(exam => ({ ...exam, examType: 'CQ' }));

        let allExams = [...mcqExams, ...cqExams];

        // Manually populate creator info from the user database
        allExams = await populateCreators(allExams);
        
        // Sort the final combined list by creation date
        allExams.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.status(200).json({
            success: true,
            count: allExams.length,
            data: allExams,
        });

    } catch (error) {
        console.error("Error in getAllExams:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Get all CQ exams
 * @route   GET /api/exams/cq
 * @access  Public (or Protected)
 */
export const getAllCqExam = async (req, res) => {
    try {
        let cqExams = await CqExam.find({})
            .populate({
                path: 'questions',
                select: 'stem subject chapter',
            })
            .sort({ createdAt: -1 })
            .lean();

        cqExams = await populateCreators(cqExams);

        res.status(200).json({
            success: true,
            count: cqExams.length,
            data: cqExams,
        });
    } catch (error) {
        console.error("Error in getAllCqExam:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Get all MCQ exams
 * @route   GET /api/exams/mcq
 * @access  Public (or Protected)
 */
export const getAllMcqExam = async (req, res) => {
    try {
        let mcqExams = await McqExam.find({})
            .populate('subject', 'name code')
            .sort({ createdAt: -1 })
            .lean();

        mcqExams = await populateCreators(mcqExams);

        res.status(200).json({
            success: true,
            count: mcqExams.length,
            data: mcqExams,
        });
    } catch (error) {
        console.error("Error in getAllMcqExam:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Get a single CQ exam by ID
 * @route   GET /api/exams/cq/:id
 * @access  Public (or Protected)
 */
export const getCqExamById = async (req, res) => {
    try {
        let exam = await CqExam.findById(req.params.id)
            .populate({
                path: 'questions', // Populate the full question details
                populate: { path: 'subject chapter.chapterId cTopic.topicId dTopic.topicId' } // Deep populate
            })
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: "CQ Exam not found" });
        }

        // Use the helper for a single item by passing it in an array
        const populatedExamArray = await populateCreators([exam]);
        
        res.status(200).json({ success: true, data: populatedExamArray[0] });
    } catch (error) {
        console.error("Error in getCqExamById:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Get a single MCQ exam by ID
 * @route   GET /api/exams/mcq/:id
 * @access  Public (or Protected)
 */
export const getMcqExamById = async (req, res) => {
    try {
        let exam = await McqExam.findById(req.params.id)
            .populate('subject')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: "MCQ Exam not found" });
        }
        
        const populatedExamArray = await populateCreators([exam]);

        res.status(200).json({ success: true, data: populatedExamArray[0] });
    } catch (error) {
        console.error("Error in getMcqExamById:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};


// --- CREATE Functions ---

/**
 * @desc    Create a new CQ exam by fetching questions from the database
 * @route   POST /api/exams/cq
 * @access  Protected (Admin)
 * @body    { title, duration, subjectCode, subjectId, chapterId, questionCount, topicId, type }
 */
export const createCqExam = async (req, res) => {
    try {
        const { title, duration, subjectCode, subjectId, chapterId, questionCount, topicId, type } = req.body;
        
        // Assuming user ID is available from an auth middleware
        // const creatorId = req.user.id; 
        const creatorId = "65a56a6441b83517c2f06a1d"; // Dummy ID for demonstration

        // 1. Build the match query for fetching questions
        const matchStage = {
            subject: new mongoose.Types.ObjectId(subjectId),
            'chapter.chapterId': new mongoose.Types.ObjectId(chapterId),
        };

        // Add optional filters for topic and type
        if (topicId) {
            matchStage['$or'] = [
                { 'cTopic.topicId': new mongoose.Types.ObjectId(topicId) },
                { 'dTopic.topicId': new mongoose.Types.ObjectId(topicId) }
            ];
        }
        if (type) {
            // Using a regex for flexible matching (e.g., 'analysis', 'application')
            matchStage['$or'] = [
                ...(matchStage['$or'] || []), // preserve existing $or if topicId was also present
                { 'cType': { $regex: type, $options: 'i' } },
                { 'dType': { $regex: type, $options: 'i' } }
            ];
        }

        // 2. Fetch random questions using an aggregation pipeline
        const randomQuestions = await CreativeQuestion.aggregate([
            { $match: matchStage },
            { $sample: { size: Number(questionCount) } }
        ]);

        if (randomQuestions.length < questionCount) {
            return res.status(400).json({
                success: false,
                message: `Could not find enough questions. Found only ${randomQuestions.length} out of ${questionCount} required.`,
            });
        }

        const questionIds = randomQuestions.map(q => q._id);

        // 3. Create the new CQ Exam
        const newExam = await CqExam.create({
            title,
            duration,
            subject: { code: subjectCode },
            questions: questionIds,
            creator: creatorId,
            source: 'database', // As we are fetching from our DB
        });

        res.status(201).json({
            success: true,
            message: "CQ Exam created successfully",
            data: newExam,
        });

    } catch (error) {
        console.error("Error in createCqExam:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

/**
 * @desc    Create a new MCQ exam by fetching questions from the database
 * @route   POST /api/exams/mcq
 * @access  Protected (Admin)
 * @body    { title, description, level, subject, chapterIndex, totalMarks, timeLimitInMinutes }
 */
export const createMcqExam = async (req, res) => {
    try {
        const { title, description, level, subject, chapterIndex, totalMarks, timeLimitInMinutes } = req.body;
        // const creatorId = req.user.id;
        const creatorId = "65a56a6441b83517c2f06a1d"; // Dummy ID

        // 1. Fetch random MCQs
        const randomQuestions = await MCQ.aggregate([
            { 
                $match: { 
                    subject: new mongoose.Types.ObjectId(subject), 
                    chapterIndex: Number(chapterIndex) 
                } 
            },
            { $sample: { size: Number(totalMarks) } } // Assuming 1 mark per question
        ]);

        if (randomQuestions.length < totalMarks) {
            return res.status(400).json({
                success: false,
                message: `Could not find enough MCQs. Found only ${randomQuestions.length} out of ${totalMarks} required.`,
            });
        }
        
        // 2. Create the new MCQ Exam
        const newExam = await McqExam.create({
            title,
            description,
            level,
            subject,
            chapterIndex,
            totalMarks,
            timeLimitInMinutes,
            questions: randomQuestions, // Embed the full question documents
            creator: creatorId,
        });

        res.status(201).json({
            success: true,
            message: "MCQ Exam created successfully",
            data: newExam,
        });

    } catch (error) {
        console.error("Error in createMcqExam:", error);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};