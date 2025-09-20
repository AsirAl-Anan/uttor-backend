import mongoose from 'mongoose';
import CreativeQuestion from '../../models/creativeQuestion.model.js';
import Subject from '../../models/subject.model.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';
import { responseChain } from '../../llm/chains/response.chain.js';
// Import the new chain
import { contextualParameterChain } from '../../llm/chains/parameter.filler.chain.js';
import { CqExam } from '../../models/cq.exam.model.js';
const TIME_PER_CQ_MIN = 20;

const calculateExamTime = (examType, questionCount) => {
  if (examType === 'CQ') return questionCount * TIME_PER_CQ_MIN;
  return 0;
};

// This streaming helper is still useful for long responses without buttons.
async function* streamLlmResponse(llmPromise) {
    const responseStream = await llmPromise;
    for await (const chunk of responseStream) {
        yield { text: chunk };
    }
}

const handleCreateExam = async function* ({ parameters, userId, chat_history }) {
    // We will use a mutable variable for parameters now
    let contextualParams = parameters;

    try {
        const user = await User.findById(userId.userId);
        if (!user) {
            yield { text: "I'm sorry, I couldn't find your user profile." };
            return;
        }
        const userVersion = (user?.version || 'English').toLowerCase();

        // =================================================================
        // =========== FIX: USE THE CONTEXT FILLER CHAIN FIRST =============
        // =================================================================
        if (!parameters.exam_type || !parameters.subject || !parameters.chapter || !parameters.question_count) {
            logger.info('[Exam Tool] Incomplete parameters. Attempting to fill from history.');
            try {
                contextualParams = await contextualParameterChain.invoke({
                    parameters: parameters,
                    chat_history: chat_history,
                });
                logger.info('[Exam Tool] Parameters filled from history:', contextualParams);
            } catch (e) {
                logger.error('[Exam Tool] Contextual parameter filler failed:', e);
                contextualParams = parameters;
            }
        }
        // ======================= END OF FIX ==============================

        const { exam_type, subject, chapter, question_count, source = 'database' } = contextualParams;

        logger.info(`[Exam Tool] Initial Parameters. User: ${userId.userId}, Type: ${exam_type}, Subject: ${subject}, Chapter: ${chapter}, Count: ${question_count}`);

        // --- Step 1: Check for essential information (exam type, subject, chapter) ---
        const missingFields = [];
        if (!exam_type) missingFields.push('the exam type (like MCQ or CQ)');
        if (!subject) missingFields.push('the subject');
        if (!chapter) missingFields.push('the chapter');

        if (missingFields.length > 0) {
            const llmPromise = responseChain.invoke({
                situation: 'MISSING_INFO',
                parameters: { missing: missingFields, provided: { exam_type, subject, chapter } },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        // --- Step 2: Validate Subject (and handle ambiguity) ---
        const subjectRegex = new RegExp(subject.trim(), 'i');
        const subjectDocs = await Subject.find({
            level: user.level,
            version: userVersion,
            $or: [
                { name: subjectRegex },
                { 'aliases.english': subjectRegex },
                { 'aliases.bangla': subjectRegex },
                { 'aliases.banglish': subjectRegex },
            ]
        });

        if (subjectDocs.length === 0) {
            const availableSubjects = await Subject.find({ level: user.level, version: userVersion }, 'name');
            const llmPromise = responseChain.invoke({
                situation: 'SUBJECT_NOT_FOUND',
                parameters: { subjectInput: subject, availableSubjects: availableSubjects.map(s => s.name) },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        if (subjectDocs.length > 1) {
            const llmPromise = responseChain.invoke({
                situation: 'AMBIGUOUS_SUBJECT',
                parameters: { subjectInput: subject, matchedSubjects: subjectDocs.map(s => s.name) },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        const subjectDoc = subjectDocs[0];
        const canonicalSubjectName = subjectDoc.name;

        // --- Step 3: Check for and Validate Question Count ---
        const maxQuestions = subjectDoc.group === 'science' ? 8 : 11;
        
        if (!question_count) {
            logger.info('[Exam Tool] Missing question_count. Asking user and providing button.');
            
            const responseText = await responseChain.invoke({
                situation: 'MISSING_QUESTION_COUNT',
                parameters: { maxQuestions: maxQuestions, subject: canonicalSubjectName, chapter: chapter },
                user_Language: userVersion,
                chat_history
            });

            const buttonPayload = `Create a ${exam_type} exam on ${canonicalSubjectName} ${chapter} with ${maxQuestions} questions`;

            yield {
                text: responseText,
                buttons: [{
                    label: `Okay, create with ${maxQuestions} questions`,
                    payload: buttonPayload
                }]
            };
            return;
        }

        const requestedCount = parseInt(question_count, 10);
        if (isNaN(requestedCount) || requestedCount <= 0 || requestedCount > maxQuestions) {
            logger.warn(`[Exam Tool] Invalid question_count: ${question_count}. Max allowed: ${maxQuestions}`);
            const llmPromise = responseChain.invoke({
                situation: 'INVALID_QUESTION_COUNT',
                parameters: {
                    requestedCount: question_count,
                    maxQuestions: maxQuestions,
                    subject: canonicalSubjectName
                },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        // --- Step 4: Validate Chapter (and handle ambiguity) ---
        const chapterRegex = new RegExp(chapter.trim(), 'i');
        const matchedChapters = subjectDoc.chapters.filter(chap => {
            if (chapterRegex.test(chap.name)) return true;
            if (chap.aliases) {
                if (chap.aliases.english && chap.aliases.english.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.bangla && chap.aliases.bangla.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.banglish && chap.aliases.banglish.some(alias => chapterRegex.test(alias))) return true;
            }
            return false;
        });

        if (matchedChapters.length === 0) {
            const llmPromise = responseChain.invoke({
                situation: 'CHAPTER_NOT_FOUND',
                parameters: { subject: canonicalSubjectName, chapterInput: chapter, availableChapters: subjectDoc.chapters.map(c => c.name) },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        if (matchedChapters.length > 1) {
            const llmPromise = responseChain.invoke({
                situation: 'AMBIGUOUS_CHAPTER',
                parameters: { subject: canonicalSubjectName, chapterInput: chapter, matchedChapters: matchedChapters.map(c => c.name) },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        const matchedChapterObject = matchedChapters[0];
        const canonicalChapterName = matchedChapterObject.name;
        
        const matchedChapterIndex = subjectDoc.chapters.findIndex(
            chap => chap.name === canonicalChapterName
        );

        if (matchedChapterIndex === -1) {
            logger.error(`[Exam Tool] Internal error: Could not find the index for a matched chapter named "${canonicalChapterName}"`);
            yield { text: "I'm sorry, a small internal error occurred. Please try asking again." };
            return;
        }
        
        // --- Step 5: DECISIVE ACTION ---
        const workingResponse = await responseChain.invoke({
            situation: 'VALIDATION_SUCCESS_PROCEEDING',
            parameters: { exam_type, subject: canonicalSubjectName, chapter: canonicalChapterName },
            user_Language: userVersion,
            chat_history
        });
        
        yield { text: workingResponse };

        // --- Step 6: Create the Exam from the Database ---
        if (source === 'database') {
            if (exam_type === 'CQ') {
                logger.info("CREATING CQ EXAM");
                const queryVersion = userVersion.charAt(0).toUpperCase() + userVersion.slice(1);
                
                const allPossibleChapterNames = [
                    matchedChapterObject.name,
                    ...(matchedChapterObject.aliases?.english || []),
                    ...(matchedChapterObject.aliases?.bangla || []),
                    ...(matchedChapterObject.aliases?.banglish || []),
                ];

                logger.info(`[Exam Tool] Querying for Subject ID: ${subjectDoc._id}, Chapter Names: [${allPossibleChapterNames.join(', ')}], Version: ${queryVersion}`);

                const questions = await CreativeQuestion.aggregate([
                    {
                        $match: {
                            'version': queryVersion,
                            'subject': subjectDoc._id,
                            $or: [
                                { 'chapter.englishName': { $in: allPossibleChapterNames } },
                                { 'chapter.banglaName': { $in: allPossibleChapterNames } }
                            ]
                        }
                    },
                    { $sample: { size: requestedCount } }
                ]);

                logger.info(`[Exam Tool] Found ${questions.length} questions matching criteria.`);
                
                if (questions.length === 0) {
                    logger.warn("NO_QUESTIONS_FOUND");
                    const llmPromise = responseChain.invoke({
                        situation: 'NO_QUESTIONS_FOUND',
                        parameters: { subject: canonicalSubjectName, chapter: canonicalChapterName, exam_type },
                        user_Language: userVersion,
                        chat_history
                    });
                    yield* await streamLlmResponse(llmPromise);
                    return;
                }
                
                if (questions.length < requestedCount) {
                    logger.warn("INSUFFICIENT_QUESTIONS_FOUND");
                    const llmPromise = responseChain.invoke({
                        situation: 'INSUFFICIENT_QUESTIONS_FOUND',
                        parameters: { subject: canonicalSubjectName, chapter: canonicalChapterName, requestedCount: requestedCount, foundCount: questions.length },
                        user_Language: userVersion,
                        chat_history
                    });
                    yield* await streamLlmResponse(llmPromise);
                }
                
                const timeLimitInMinutes = calculateExamTime(exam_type, questions.length);

                const examData = {
                    questions: questions.map(q => q._id),
                    creator: userId.userId.toString(),
                    isActive: true,
                    title: `CQ Exam: ${canonicalSubjectName} - ${canonicalChapterName}`,
                    duration: timeLimitInMinutes,
                    source: source,
                    subject: {
                        code: subjectDoc.subjectCode,
                        id: subjectDoc._id,
                    },
                    chapter: { 
                        index: matchedChapterIndex, 
                        name: canonicalChapterName,
                    }
                };

                const newExam = new CqExam(examData);
                const savedExam = await newExam.save();
                logger.info(`[Exam Tool] CQ Exam created successfully with ID: ${savedExam._id}`);
                
                const examId = savedExam._id.toString();

                const successText = await responseChain.invoke({
                    situation: 'EXAM_CREATED_SUCCESS',
                    parameters: {
                        exam_type,
                        question_count: questions.length,
                        subject: canonicalSubjectName,
                        chapter: canonicalChapterName,
                        timeLimit: timeLimitInMinutes,
                        examId: examId
                    },
                    user_Language: userVersion,
                    chat_history
                });

                yield {
                    text: successText,
                    buttons: [
                        {
                            label: 'Start Exam',
                            payload: `/exam/${examId}`,
                            type: 'link'
                        }
                    ]
                };
                return;

            } else {
                yield { text: `Support for ${exam_type} exams is not fully implemented yet.` };
                return;
            }
        } else {
            logger.warn("AI_GENERATION_UNAVAILABLE");
            const llmPromise = responseChain.invoke({
                situation: 'AI_GENERATION_UNAVAILABLE',
                parameters: {},
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
        }
    } catch (error) {
        logger.error('[Exam Tool] Error creating exam:', error);
        yield { text: "I'm sorry, I ran into an unexpected problem. My developers have been notified." };
    }
};


// ===================================================================
// ==================== NEW STATIC FUNCTION ==========================
// ===================================================================

/**
 * Creates a CQ exam statically without conversational interaction.
 * @param {object} params - The parameters for creating the exam.
 * @param {string} params.userId - The ID of the user creating the exam.
 * @param {string} params.subjectName - The name of the subject (e.g., "Physics").
 * @param {string} params.chapterName - The name of the chapter (e.g., "Chapter 1").
 * @param {number} params.questionCount - The number of questions for the exam.
 * @returns {Promise<string>} The ID of the newly created exam.
 * @throws {Error} Throws an error if validation fails or exam creation is unsuccessful.
 */
export const createExam = async ({ userId, subjectName, chapterName, questionCount }) => {
    logger.info(`[Static Exam Service] Attempting to create exam for user ${userId}`);

    try {
        // --- Step 0: Basic validation ---
        if (!userId || !subjectName || !chapterName || !questionCount) {
            throw new Error("Missing required parameters: userId, subjectName, chapterName, or questionCount.");
        }

        // --- Step 1: Fetch User ---
        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User not found with ID: ${userId}`);
        }
        const userVersion = (user?.version || 'English').toLowerCase();

        // --- Step 2: Validate Subject ---
        const subjectRegex = new RegExp(subjectName.trim(), 'i');
        const subjectDocs = await Subject.find({
            level: user.level,
            version: userVersion,
            $or: [ { name: subjectRegex }, { 'aliases.english': subjectRegex }, { 'aliases.bangla': subjectRegex }, { 'aliases.banglish': subjectRegex } ]
        });

        if (subjectDocs.length === 0) throw new Error(`Subject '${subjectName}' not found for user's level and version.`);
        if (subjectDocs.length > 1) throw new Error(`Ambiguous subject: '${subjectName}' matched multiple subjects.`);
        
        const subjectDoc = subjectDocs[0];
        const canonicalSubjectName = subjectDoc.name;

        // --- Step 3: Validate Question Count ---
        const maxQuestions = subjectDoc.group === 'science' ? 8 : 11;
        const requestedCount = parseInt(questionCount, 10);
        if (isNaN(requestedCount) || requestedCount <= 0 || requestedCount > maxQuestions) {
            throw new Error(`Invalid question count: ${questionCount}. Must be a number between 1 and ${maxQuestions}.`);
        }

        // --- Step 4: Validate Chapter ---
        const chapterRegex = new RegExp(chapterName.trim(), 'i');
        const matchedChapters = subjectDoc.chapters.filter(chap => {
            if (chapterRegex.test(chap.name)) return true;
            if (chap.aliases) {
                if (chap.aliases.english && chap.aliases.english.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.bangla && chap.aliases.bangla.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.banglish && chap.aliases.banglish.some(alias => chapterRegex.test(alias))) return true;
            }
            return false;
        });

        if (matchedChapters.length === 0) throw new Error(`Chapter '${chapterName}' not found in subject '${canonicalSubjectName}'.`);
        if (matchedChapters.length > 1) throw new Error(`Ambiguous chapter: '${chapterName}' matched multiple chapters in '${canonicalSubjectName}'.`);
        
        const matchedChapterObject = matchedChapters[0];
        const canonicalChapterName = matchedChapterObject.name;
        const matchedChapterIndex = subjectDoc.chapters.findIndex(chap => chap.name === canonicalChapterName);
        if (matchedChapterIndex === -1) throw new Error("Internal server error: Could not determine chapter index.");

        // --- Step 5: Fetch Questions and Create Exam ---
        const queryVersion = userVersion.charAt(0).toUpperCase() + userVersion.slice(1);
        const allPossibleChapterNames = [
            matchedChapterObject.name,
            ...(matchedChapterObject.aliases?.english || []),
            ...(matchedChapterObject.aliases?.bangla || []),
            ...(matchedChapterObject.aliases?.banglish || []),
        ];

        const questions = await CreativeQuestion.aggregate([
            { $match: { 'version': queryVersion, 'subject': subjectDoc._id, $or: [ { 'chapter.englishName': { $in: allPossibleChapterNames } }, { 'chapter.banglaName': { $in: allPossibleChapterNames } } ] } },
            { $sample: { size: requestedCount } }
        ]);

        if (questions.length === 0) {
            throw new Error(`No questions found for subject '${canonicalSubjectName}' and chapter '${canonicalChapterName}'.`);
        }
        if (questions.length < requestedCount) {
            logger.warn(`[Static Exam Service] Insufficient questions found. Requested ${requestedCount}, but found ${questions.length}. Proceeding with available questions.`);
        }

        const timeLimitInMinutes = calculateExamTime('CQ', questions.length);

        const examData = {
            questions: questions.map(q => q._id),
            creator: user._id.toString(),
            isActive: true,
            title: `CQ Exam: ${canonicalSubjectName} - ${canonicalChapterName}`,
            duration: timeLimitInMinutes,
            source: 'database',
            subject: {
                code: subjectDoc.subjectCode,
                id: subjectDoc._id,
            },
            chapter: { 
                index: matchedChapterIndex, 
                name: canonicalChapterName,
            }
        };

        const newExam = new CqExam(examData);
        const savedExam = await newExam.save();
        
        logger.info(`[Static Exam Service] Exam ${savedExam._id} created successfully.`);
        return savedExam._id.toString();

    } catch (error) {
        logger.error('[Static Exam Service] Failed to create exam:', error);
        // Re-throw the error so the calling function can handle it
        throw error;
    }
};

export const examTool = {
    handleCreateExam,
};