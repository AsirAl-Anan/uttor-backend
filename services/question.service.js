// question.service.js

import Subject from "../models/subject.model.js";
import CreativeQuestion from "../models/creativeQuestion.model.js";
import Topic from "../models/topic.model.js";
/**
 * Fetches subjects matching the user's profile.
 * @param {string} level - User's level (e.g., 'HSC')
 * @param {string} version - User's version (e.g., 'bangla')
 * @param {string} group - User's group (e.g., 'science')
 * @returns {Promise<Array>} A promise that resolves to an array of subjects.
 */
export const getSubjectsForUser = async (level, version, group) => {
    // We find subjects that match the user's level and group, and are available in their version.
    const subjects = await Subject.find({ level, group:"science", version:"english" })
                                  .select('name subjectCode') // Only return necessary fields
                                  .lean(); // Use .lean() for faster read-only operations
                                  return subjects;
};

/**
 * Gathers all unique chapters, topics, and question types for a given subjectId.
 * @param {string} subjectId - The MongoDB ObjectId of the subject.
 * @returns {Promise<Object>} An object containing arrays of chapters, topics, and types.
 */
export const getFilterOptionsForSubject = async (subjectId) => {
    const subject = await Subject.findById(subjectId)
  .populate({
    path: 'chapters.topics',
    select: 'name questionTypes',
    model: 'Topic',
  })
  .lean();

    if (!subject) {
        throw new Error("Subject not found");
    }

    const chapters = subject.chapters.map(ch => ({ id: ch._id, name: ch.name }));

    const topicSet = new Map();
    const typeSet = new Set();

    subject.chapters.forEach(chapter => {
        if (chapter.topics && Array.isArray(chapter.topics)  ) {
            chapter.topics.forEach(topic => {
                // Add unique topics using a Map to store id and name
                if (topic && topic._id && !topicSet.has(topic._id.toString())) {
                    topicSet.set(topic._id.toString(), { id: topic._id, name: topic.name });
                }

                // Add unique question types
                if (topic.questionTypes && Array.isArray(topic.questionTypes)) {
                    topic.questionTypes.forEach(qType => {
                        if (qType && qType.name) {
                            typeSet.add(qType.name);
                        }
                    });
                }
            });
        }
    });
    
    // Convert Map values and Set to arrays
    const topics = Array.from(topicSet.values());
    const types = Array.from(typeSet);

    return { chapters, topics, types };
};

/**
 * Fetches creative questions from the database based on a set of filters.
 * @param {Object} filters - An object containing filter criteria.
 * @returns {Promise<Array>} A promise that resolves to an array of creative questions.
 */
export const getFilteredCreativeQuestions = async (filters,version) => {
     const query = {};
    console.log('got filters' , filters)
     // Build the query object dynamically based on provided filters
     if (filters.subjectId) query.subject = filters.subjectId;
     if (filters.board) query.board = filters.board;
     if (filters.year) query.year = Number(filters.year); // Ensure year is a number
     if (filters.chapterId) query['chapter.chapterId'] = filters.chapterId;

     // For topic and type, a question can match in either part C or part D.
     // So we use an $or condition.
     const orConditions = [];

     if (filters.topicId) {
         orConditions.push(
             { 'cTopic.topicId': filters.topicId }, 
             { 'dTopic.topicId': filters.topicId }
         );
     }

     if (filters.type) {
         orConditions.push(
             { 'cQuestionType': filters.type },
             { 'dQuestionType': filters.type }
         );
     }
    
     if (orConditions.length > 0) {
         // If there's only one $or condition group (e.g., only topicId is present)
         // we can just use $or. If both are present, we should use $and with two $or clauses,
         // but for simplicity, a single $or covers the case where a question matches EITHER the topic OR the type.
         // A more strict filter would require an $and. Let's assume a broad match is fine.
         query.$or = orConditions;
     }
     query.version = version || "English";

     // You can add pagination here later if needed (e.g., using .limit() and .skip())
     const questions = await CreativeQuestion.find(query)
         .populate('subject', 'name') // Populate subject name
         .populate('cTopic.topicId', 'name') // Populate topic names
         .populate('dTopic.topicId', 'name')
         .sort({ year: -1 }) // Sort by most recent year
         .lean();

     return questions;
};