import mongoose from 'mongoose';
import CreativeQuestion from '../../models/creativeQuestion.model.js';
import Subject from '../../models/subject.model.js';
import User from '../../models/User.js';
import logger from '../../utils/logger.js';
import { responseChain } from '../../llm/chains/response.chain.js';
import { contextualParameterChain } from '../../llm/chains/parameter.filler.chain.js';
import { CqExam } from '../../models/cq.exam.model.js';
import McqExam from '../../models/mcq.exam.model.js';
import { createMcqExamFromImage } from '../../services/aiExam.service.js';

const TIME_PER_CQ_MIN = 20;
const TIME_PER_MCQ_MIN = 1;
const MAX_MCQ_SCIENCE = 25;
const MAX_MCQ_NON_SCIENCE = 30;
const MAX_CQ_SCIENCE = 8;
const MAX_CQ_NON_SCIENCE = 11;

const calculateExamTime = (examType, questionCount) => {
  if (examType === 'CQ') return questionCount * TIME_PER_CQ_MIN;
  if (examType === 'MCQ') return questionCount * TIME_PER_MCQ_MIN;
  return 0;
};

async function* streamLlmResponse(llmPromise) {
    const responseStream = await llmPromise;
    for await (const chunk of responseStream) {
        yield { text: chunk };
    }
}

/**
 * DEFINITIVELY CORRECTED HELPER
 * Finds the most recent image URL from the chat history by correctly parsing
 * LangChain's HumanMessage/AIMessage object structure.
 * @param {Array<Object>} history - An array of LangChain Message objects.
 * @returns {string|null} The found image URL or null.
 */


const handleCreateExam = async function* ({ parameters, userId, chat_history }) {
    let contextualParams = parameters;

    try {
        const user = await User.findById(userId.userId);
        if (!user) {
            yield { text: "I'm sorry, I couldn't find your user profile." };
            return;
        }
        const userVersion = (user?.version || 'English').toLowerCase();

        // The contextual chain is still useful for multi-turn text conversations.
        let enrichedParams = {};
        try {
            const filledParamsFromHistory = await contextualParameterChain.invoke({
                parameters: parameters,
                chat_history: chat_history,
            });
            // IMPORTANT: Ensure the original parameters (which now include the image_url) overwrite the history.
            enrichedParams = { ...filledParamsFromHistory, ...parameters };
            logger.info('[Exam Tool] Parameters after intelligent merge:', enrichedParams);
        } catch (e) {
            logger.error('[Exam Tool] Contextual parameter filler chain failed:', e);
            enrichedParams = parameters;
        }
        contextualParams = enrichedParams;

        const { exam_type, subject, chapter, question_count, source, image_url } = contextualParams;
        
        let effectiveSource;
        if (exam_type === 'MCQ') {
            effectiveSource = 'ai';
        } else {
            effectiveSource = source || 'database';
        }

        logger.info(`[Exam Tool] Effective Parameters. User: ${userId.userId}, Type: ${exam_type}, Subject: ${subject}, Chapter: ${chapter}, Count: ${question_count}, Source: ${effectiveSource}, Image: ${!!image_url}`);

        if (exam_type === 'MCQ' && effectiveSource === 'ai' && !image_url) {
            // This condition is now the final backstop if a user asks for an MCQ exam
            // over multiple turns without ever providing an image.
            yield { text: "I don't have a database of MCQs yet. To create an MCQ exam, please provide an image with the topic text." };
            return;
        }

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

        const subjectRegex = new RegExp(subject.trim(), 'i');
        const subjectDocs = await Subject.find({
            level: user.level, version: userVersion,
            $or: [ { name: subjectRegex }, { 'aliases.english': subjectRegex }, { 'aliases.bangla': subjectRegex }, { 'aliases.banglish': subjectRegex } ]
        });

        if (subjectDocs.length === 0) {
            const availableSubjects = await Subject.find({ level: user.level, version: userVersion }, 'name');
            const llmPromise = responseChain.invoke({ situation: 'SUBJECT_NOT_FOUND', parameters: { subjectInput: subject, availableSubjects: availableSubjects.map(s => s.name) }, user_Language: userVersion, chat_history });
            yield* await streamLlmResponse(llmPromise);
            return;
        }
        if (subjectDocs.length > 1) {
            const llmPromise = responseChain.invoke({ situation: 'AMBIGUOUS_SUBJECT', parameters: { subjectInput: subject, matchedSubjects: subjectDocs.map(s => s.name) }, user_Language: userVersion, chat_history });
            yield* await streamLlmResponse(llmPromise);
            return;
        }
        const subjectDoc = subjectDocs[0];
        const canonicalSubjectName = subjectDoc.name;

        let maxQuestions;
        if (exam_type === 'CQ') {
            maxQuestions = subjectDoc.group === 'science' ? MAX_CQ_SCIENCE : MAX_CQ_NON_SCIENCE;
        } else if (exam_type === 'MCQ') {
            maxQuestions = subjectDoc.group === 'science' ? MAX_MCQ_SCIENCE : MAX_MCQ_NON_SCIENCE;
        } else {
             yield { text: `I'm sorry, I don't know how to create a "${exam_type}" exam.` };
             return;
        }

        if (!question_count) {
            logger.info('[Exam Tool] Missing question_count. Asking user.');
            const responseText = await responseChain.invoke({
                situation: 'MISSING_QUESTION_COUNT',
                parameters: { maxQuestions: maxQuestions, subject: canonicalSubjectName, chapter: chapter },
                user_Language: userVersion,
                chat_history
            });
            const buttonPayload = `Create a ${exam_type} exam on ${canonicalSubjectName} ${chapter} with ${maxQuestions} questions`;
            yield { text: responseText, buttons: [{ label: `Okay, create with ${maxQuestions} questions`, payload: buttonPayload }] };
            return;
        }

        const requestedCount = parseInt(question_count, 10);
        if (isNaN(requestedCount) || requestedCount <= 0 || requestedCount > maxQuestions) {
            logger.warn(`[Exam Tool] Invalid question_count: ${question_count}. Max allowed: ${maxQuestions}`);
            const llmPromise = responseChain.invoke({
                situation: 'INVALID_QUESTION_COUNT',
                parameters: { requestedCount: question_count, maxQuestions: maxQuestions, subject: canonicalSubjectName },
                user_Language: userVersion,
                chat_history
            });
            yield* await streamLlmResponse(llmPromise);
            return;
        }

        const chapterRegex = new RegExp(chapter.trim(), 'i');
        const matchedChapters = subjectDoc.chapters.filter(chap => {
            if (chapterRegex.test(chap.name)) return true;
            if (chap.aliases) {
                if (chap.aliases.english?.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.bangla?.some(alias => chapterRegex.test(alias))) return true;
                if (chap.aliases.banglish?.some(alias => chapterRegex.test(alias))) return true;
            }
            return false;
        });

        if (matchedChapters.length === 0) {
            const llmPromise = responseChain.invoke({ situation: 'CHAPTER_NOT_FOUND', parameters: { subject: canonicalSubjectName, chapterInput: chapter, availableChapters: subjectDoc.chapters.map(c => c.name) }, user_Language: userVersion, chat_history });
            yield* await streamLlmResponse(llmPromise);
            return;
        }
        if (matchedChapters.length > 1) {
            const llmPromise = responseChain.invoke({ situation: 'AMBIGUOUS_CHAPTER', parameters: { subject: canonicalSubjectName, chapterInput: chapter, matchedChapters: matchedChapters.map(c => c.name) }, user_Language: userVersion, chat_history });
            yield* await streamLlmResponse(llmPromise);
            return;
        }
        const matchedChapterObject = matchedChapters[0];
        const canonicalChapterName = matchedChapterObject.name;
        const matchedChapterIndex = subjectDoc.chapters.findIndex(chap => chap.name === canonicalChapterName);

        if (matchedChapterIndex === -1) {
            logger.error(`[Exam Tool] Internal error: Could not find index for chapter "${canonicalChapterName}"`);
            yield { text: "I'm sorry, a small internal error occurred. Please try asking again." };
            return;
        }

        const workingResponse = await responseChain.invoke({
            situation: 'VALIDATION_SUCCESS_PROCEEDING',
            parameters: { exam_type, subject: canonicalSubjectName, chapter: canonicalChapterName },
            user_Language: userVersion,
            chat_history
        });
        yield { text: workingResponse };

        if (exam_type === 'CQ') {
            if (effectiveSource === 'database') {
                yield* handleCqExamCreationFromDb({ userId, subjectDoc, matchedChapterObject, requestedCount, canonicalSubjectName, canonicalChapterName, matchedChapterIndex, userVersion, chat_history });
            } else {
                 yield { text: `Sorry, I can only create CQ exams from the database right now.` };
            }
        } else if (exam_type === 'MCQ') {
            if (effectiveSource === 'ai') {
                yield* handleMcqExamCreationFromAi({ userId, user, subjectDoc, requestedCount, canonicalSubjectName, canonicalChapterName, matchedChapterIndex, image_url, userVersion, chat_history });
            }
        } else {
            yield { text: `Support for ${exam_type} exams is not fully implemented yet.` };
        }

    } catch (error) {
        logger.error('[Exam Tool] Critical error during exam creation:', error);
        yield { text: error.message || "I'm sorry, I ran into an unexpected problem. My developers have been notified." };
    }
};

async function* handleCqExamCreationFromDb({ userId, subjectDoc, matchedChapterObject, requestedCount, canonicalSubjectName, canonicalChapterName, matchedChapterIndex, userVersion, chat_history }) {
    logger.info("CREATING CQ EXAM FROM DATABASE");
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
        const llmPromise = responseChain.invoke({ situation: 'NO_QUESTIONS_FOUND', parameters: { subject: canonicalSubjectName, chapter: canonicalChapterName, exam_type: 'CQ' }, user_Language: userVersion, chat_history });
        yield* await streamLlmResponse(llmPromise);
        return;
    }
    
    if (questions.length < requestedCount) {
        const llmPromise = responseChain.invoke({ situation: 'INSUFFICIENT_QUESTIONS_FOUND', parameters: { subject: canonicalSubjectName, chapter: canonicalChapterName, requestedCount: requestedCount, foundCount: questions.length }, user_Language: userVersion, chat_history });
        yield* await streamLlmResponse(llmPromise);
    }

    const timeLimitInMinutes = calculateExamTime('CQ', questions.length);
    const examData = {
        questions: questions.map(q => q._id),
        creator: userId.userId.toString(),
        title: `CQ Exam: ${canonicalSubjectName} - ${canonicalChapterName}`,
        duration: timeLimitInMinutes,
        source: 'database',
        subject: { code: subjectDoc.subjectCode, id: subjectDoc._id },
        chapter: { index: matchedChapterIndex, name: canonicalChapterName }
    };

    const newExam = new CqExam(examData);
    const savedExam = await newExam.save();
    logger.info(`[Exam Tool] CQ Exam created successfully with ID: ${savedExam._id}`);
    
    const examId = savedExam._id.toString();
    const successText = await responseChain.invoke({
        situation: 'EXAM_CREATED_SUCCESS',
        parameters: { exam_type: 'CQ', question_count: questions.length, subject: canonicalSubjectName, chapter: canonicalChapterName, timeLimit: timeLimitInMinutes, examId: examId },
        user_Language: userVersion,
        chat_history
    });

    yield { text: successText, buttons: [{ label: 'Start Exam', payload: `/exam/cq/${examId}`, type: 'link' }] };
}

async function* handleMcqExamCreationFromAi({ userId, user, subjectDoc, requestedCount, canonicalSubjectName, canonicalChapterName, matchedChapterIndex, image_url, userVersion, chat_history }) {
    logger.info("CREATING MCQ EXAM FROM AI");

    try {
        const generatedQuestions = await createMcqExamFromImage({
            imageUrl: image_url,
            subject: canonicalSubjectName,
            chapter: canonicalChapterName,
            count: requestedCount,
            userLanguage: userVersion
        });
        
        if (!generatedQuestions || generatedQuestions.length === 0) {
             yield { text: "I'm sorry, the AI was unable to generate any questions from the image you provided. Please try a different one." };
             return;
        }

        const actualQuestionCount = generatedQuestions.length;
        const timeLimitInMinutes = calculateExamTime('MCQ', actualQuestionCount);
        
        const examData = {
            title: `AI Generated MCQ Exam: ${canonicalSubjectName} - ${canonicalChapterName}`,
            level: user.level,
            subject: { id: subjectDoc._id },
            chapter: { name: canonicalChapterName, index: matchedChapterIndex },
            totalMarks: actualQuestionCount,
            timeLimitInMinutes: timeLimitInMinutes,
            questions: generatedQuestions,
            creator: userId.userId.toString(),
            isActive: true,
            source: 'ai'
        };

        const newExam = new McqExam(examData);
        const savedExam = await newExam.save();
        logger.info(`[Exam Tool] AI MCQ Exam created successfully with ID: ${savedExam._id}`);

        const examId = savedExam._id.toString();
        const successText = await responseChain.invoke({
            situation: 'EXAM_CREATED_SUCCESS',
            parameters: { exam_type: 'MCQ', question_count: actualQuestionCount, subject: canonicalSubjectName, chapter: canonicalChapterName, timeLimit: timeLimitInMinutes, examId: examId },
            user_Language: userVersion,
            chat_history
        });

        yield {
            text: successText,
            buttons: [{
                label: 'Start Exam',
                payload: `/exam/mcq/${examId}`,
                type: 'link'
            }]
        };
    
    } catch (error) {
        logger.error('[Exam Tool] AI MCQ creation helper failed:', error);
        yield { text: `I couldn't create the exam. ${error.message}` };
    }
}

export const createExam = async ({ userId, subjectName, chapterName, questionCount }) => {
    logger.info(`[Static Exam Service] Attempting to create exam for user ${userId}`);

    try {
        if (!userId || !subjectName || !chapterName || !questionCount) {
            throw new Error("Missing required parameters: userId, subjectName, chapterName, or questionCount.");
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new Error(`User not found with ID: ${userId}`);
        }
        const userVersion = (user?.version || 'English').toLowerCase();

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

        const maxQuestions = subjectDoc.group === 'science' ? 8 : 11;
        const requestedCount = parseInt(questionCount, 10);
        if (isNaN(requestedCount) || requestedCount <= 0 || requestedCount > maxQuestions) {
            throw new Error(`Invalid question count: ${questionCount}. Must be a number between 1 and ${maxQuestions}.`);
        }

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
        throw error;
    }
};

export const examTool = {
    handleCreateExam,
};