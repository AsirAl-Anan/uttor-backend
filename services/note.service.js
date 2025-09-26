import Subject from '../models/subject.model.js';
import Topic from '../models/topic.model.js';

/**
 * Fetches subjects that match the user's profile settings (level, group, version).
 * @param {object} user - The authenticated user object.
 * @returns {Promise<Array>} A list of matching subjects.
 */
export const getAllSubjectsForUser = async (user) => {
    if (!user.level || !user.group || !user.version) {
        throw new Error('User profile is incomplete. Cannot determine relevant subjects.');
    }
    const userVersion = user.version === 'English' ? 'english' : 'bangla';
    const subjects = await Subject.find({
        level: user.level,
        group: "science",
        version: userVersion,
    }).select('name subjectCode').lean(); // .select() for performance, lean() for speed

    return subjects;
};

/**
 * Fetches the list of chapters for a given subject ID.
 * @param {string} subjectId - The MongoDB ObjectId of the subject.
 * @returns {Promise<Array>} A simplified list of chapters.
 */
export const getChaptersForSubject = async (subjectId) => {
    const subject = await Subject.findById(subjectId).select('chapters').lean();
    if (!subject) {
        throw new Error('Subject not found');
    }
    
    // Return a simplified list for the frontend, now including the topic count.
    return subject.chapters.map(ch => ({
        _id: ch._id,
        name: ch.name,
        subjectIndex: ch.subjectIndex,
        // CHANGED: Add the count of topics for each chapter.
        // The optional chaining (?.) and nullish coalescing (||) make this safe.
        topicCount: ch.topics?.length || 0, 
    }));
};

/**
 * Fetches the topics (notes) for a specific chapter within a subject.
 * @param {string} subjectId - The MongoDB ObjectId of the subject.
 * @param {string} chapterId - The MongoDB ObjectId of the chapter subdocument.
 * @returns {Promise<Array>} A list of topics for that chapter.
 */
export const getTopicsForChapter = async (subjectId, chapterId) => {
    const subject = await Subject.findById(subjectId).select('chapters').lean();
    console.log("Subject fetched:", subject);
    if (!subject) {
        throw new Error('Subject not found');
    }
    
    // FIXED: Find the chapter by its unique _id. This is more reliable.
    const chapter = subject.chapters.find(ch => ch._id.toString() === chapterId);
    if (!chapter) {
        throw new Error('Chapter not found within this subject');
    }
    
    if (!chapter.topics || chapter.topics.length === 0) {
        return []; // Return empty array if chapter has no topics
    }

    // Fetch the topics using the IDs from the chapter, selecting only necessary fields for the list view
    const topics = await Topic.find({
        _id: { $in: chapter.topics }
    }).select('name').lean();

    return topics;
};

/**
 * Fetches the full details of a single topic (note) by its ID.
 * @param {string} topicId - The MongoDB ObjectId of the topic.
 * @returns {Promise<object>} The full topic document.
 */
export const getTopicDetails = async (topicId) => {
    const topic = await Topic.findById(topicId).lean();
    if (!topic) {
        throw new Error('Note (Topic) not found');
    }
    return topic;
};