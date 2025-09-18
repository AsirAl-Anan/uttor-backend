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
            
            // ===== MODIFICATION START: ADDING CONTEXTUAL BUTTON =====
            // We get the full response instead of streaming it.
            const responseText = await responseChain.invoke({
                situation: 'MISSING_QUESTION_COUNT',
                parameters: { maxQuestions: maxQuestions, subject: canonicalSubjectName, chapter: chapter }, // Added chapter for more context
                user_Language: userVersion,
                chat_history
            });

            // The payload should be the full command the user would have typed.
            const buttonPayload = `Create a ${exam_type} exam on ${canonicalSubjectName} ${chapter} with ${maxQuestions} questions`;

            // Yield a single object with both text and the button data.
            yield {
                text: responseText,
                buttons: [{
                    label: `Okay, create with ${maxQuestions} questions`,
                    payload: buttonPayload
                }]
            };
            // ===== MODIFICATION END =====
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

        const matchedChapter = matchedChapters[0];
        const canonicalChapterName = matchedChapter.name;
        
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
                    matchedChapter.name,
                    ...(matchedChapter.aliases?.english || []),
                    ...(matchedChapter.aliases?.bangla || []),
                    ...(matchedChapter.aliases?.banglish || []),
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
                    },
                    chapters: [
                        {
                            index: matchedChapter.index,
                        }
                    ]
                };

                const newExam = new CqExam(examData);
                const savedExam = await newExam.save();
                logger.info(`[Exam Tool] CQ Exam created successfully with ID: ${savedExam._id}`);
                
                const examId = savedExam._id.toString();

                // ===== MODIFICATION START: ADDING STATIC NAVLINK BUTTON ON SUCCESS =====
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

                // This payload is a URL path for client-side navigation.
                // The frontend should check for `type: 'link'` and render a NavLink.
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
                // ===== MODIFICATION END =====
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

export const examTool = {
    handleCreateExam,
};