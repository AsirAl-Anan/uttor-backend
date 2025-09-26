// services/hub.service.js
import mongoose from 'mongoose';
import { Doubt } from '../models/doubt.model.js';
import { Answer } from '../models/answer.model.js';
import { Tag } from '../models/tag.model.js';
import User from '../models/User.js';
import { AuraTransaction } from '../models/auraTransaction.model.js';
import { uploadImage } from '../utils/cloudinary.js';
import fs from 'fs';


const handleImageUploads = async (files) => {
    if (!files || files.length === 0) {
        return [];
    }
    const imageUploadPromises = files.map(file => 
        uploadImage(file.path, { folder: 'student-hub-answers' }) // Use a specific folder
    );
    const uploadResults = await Promise.all(imageUploadPromises);
    
    // Clean up local files
    files.forEach(file => fs.unlinkSync(file.path));

    return uploadResults.map(result => {
        if (!result.success) {
            throw new Error('Image upload failed: ' + result.error);
        }
        return { publicId: result.data.publicId, url: result.data.url };
    });
};
const toObjectId = (id) => {
    if (mongoose.Types.ObjectId.isValid(id)) {
        // If it's already an ObjectId instance, return it. Otherwise, create a new one.
        if (id instanceof mongoose.Types.ObjectId) {
            return id;
        }
        return new mongoose.Types.ObjectId(id);
    }
    throw new Error(`Invalid ObjectId format: ${id}`);
};

/**
 * Creates a new doubt, uploads images, and handles tags.
 */
export const createDoubt = async (userId, doubtData, files) => {
    const { title, body, subject, chapter } = doubtData;
    let tags = [];
    if (doubtData.tags) {
        // Assuming tags are sent as a comma-separated string
        tags = doubtData.tags.split(',').map(tag => tag.trim().toLowerCase());
    }

    // --- 1. Upload images to Cloudinary ---
    const imageUploadPromises = files.map(file => 
        uploadImage(file.path, { folder: 'student-hub' })
    );
    const uploadResults = await Promise.all(imageUploadPromises);
    
    // --- 2. Clean up local files after upload ---
    files.forEach(file => fs.unlinkSync(file.path));

    const images = uploadResults.map(result => {
        if (!result.success) {
            throw new Error('Image upload failed: ' + result.error);
        }
        return { publicId: result.data.publicId, url: result.data.url };
    });

    // --- 3. Create the Doubt document ---
    const newDoubt = new Doubt({
        author: userId,
        title,
        body,
        tags,
        subject,
        chapter,
        images
    });
    await newDoubt.save();

    // --- 4. Update or create tags in the Tag collection ---
    if (tags.length > 0) {
        const tagOperations = tags.map(tagName => ({
            updateOne: {
                filter: { name: tagName },
                update: { $inc: { doubtCount: 1 } },
                upsert: true,
            },
        }));
        await Tag.bulkWrite(tagOperations);
    }
    
    return newDoubt;
};


export const getAllDoubts = async () => {
    // Populate author to get their details, sort by newest
    return await Doubt.find()
        .populate('author', 'displayName avatar name') // Select only needed fields
        .sort({ createdAt: -1 })
        .lean(); // Use .lean() for faster read operations
};

/**
 * Retrieves a single doubt and deeply populates its answers and their replies.
 */
export const getDoubtById = async (doubtId) => {
    const doubt = await Doubt.findById(doubtId)
        .populate('author', 'displayName avatar name')
        .lean();

    if (!doubt) throw new Error('Doubt not found.');

    // We define a nested population structure manually to a reasonable depth.
    // This avoids infinite recursion errors and is the most stable method.
    const populateLevel = (depth = 4) => {
        if (depth === 0) {
            // At the deepest level, just populate the author
            return { path: 'author', select: 'displayName avatar name' };
        }
        return [
            { path: 'author', select: 'displayName avatar name' },
            {
                path: 'replies',
                populate: populateLevel(depth - 1) // Recurse to the next level
            }
        ];
    };

    // Fetch only top-level answers (those that are not replies)
    const topLevelAnswers = await Answer.find({ doubt: doubtId, parentAnswer: null })
        .populate(populateLevel()) // Populate using our controlled recursive function
        .sort({ voteScore: -1, createdAt: 1 })
        .lean();

    doubt.answers = topLevelAnswers;
    return doubt;
};

/**
 * Posts a new answer to a doubt.
 */
export const postAnswer = async (userId, doubtId, body, files) => {
    const doubt = await Doubt.findById(doubtId);
    if (!doubt) throw new Error('Doubt not found.');

    const images = await handleImageUploads(files);

    const newAnswer = new Answer({
        author: userId,
        doubt: doubtId,
        body,
        images,
        parentAnswer: null // Explicitly set as a top-level answer
    });
    
    await newAnswer.save();

    return await Answer.findById(newAnswer._id).populate('author', 'displayName avatar name').lean();
};


/**
 * Handles voting on an answer and manages Aura transactions.
 */

 
// services/hub.service.js

// ... (keep other functions as they are)

export const postReply = async (userId, parentAnswerId, body, files) => {
    // Find the document we're replying to.
    const parentAnswer = await Answer.findById(parentAnswerId);
    if (!parentAnswer) {
        throw new Error('Parent answer not found.');
    }

    // Handle any image uploads.
    const images = await handleImageUploads(files);

    // Create the new reply document in memory.
    const newReply = new Answer({
        author: userId,
        doubt: parentAnswer.doubt,
        body,
        images,
        parentAnswer: parentAnswerId // Link to the parent answer
    });
    
    // --- REMOVED TRANSACTION LOGIC ---
    // We will now perform the database writes sequentially.
    try {
        // Step 1: Save the new reply document to the database.
        await newReply.save();
        
        // Step 2: Add the new reply's ID to the parent's `replies` array.
        parentAnswer.replies.push(newReply._id);
        
        // Step 3: Save the updated parent document.
        await parentAnswer.save();
    } catch (error) {
        // If either save operation fails, we'll catch it here.
        console.error('Error during postReply save operations:', error);
        // In a production system, you might add logic here to delete the `newReply` if it was saved
        // but the `parentAnswer` update failed, to prevent orphaned documents.
        // For now, throwing an error is sufficient.
        throw new Error('Could not post reply due to a database error.');
    }
    // --- END OF MODIFIED SECTION ---

    // Fetch the newly created reply and populate the author details to send back to the frontend.
    return await Answer.findById(newReply._id).populate('author', 'displayName avatar name').lean();
};
/**
 * Handles voting on a doubt.
 * --- FINAL PRODUCTION VERSION ---
 */
export const voteOnDoubt = async (voterId, doubtId, voteType) => {
    console.log("\n--- [SIMPLE TEST] voteOnDoubt Initiated ---");
    try {
        const voterObjectId = toObjectId(voterId);
        const doubtObjectId = toObjectId(doubtId);

        if (!voterObjectId || !doubtObjectId) {
            throw new Error(`Invalid ID provided. Voter: ${voterId}, Doubt: ${doubtId}`);
        }

        console.log(`[SIMPLE TEST] VoterID: ${voterObjectId}, DoubtID: ${doubtObjectId}`);
        
        // Find the document WITHOUT a transaction to get its current state
        const doubt = await Doubt.findById(doubtObjectId).lean();
        if (!doubt) {
            throw new Error('Doubt not found.');
        }

        console.log("[SIMPLE TEST] Found doubt successfully.");

        // Check if voter is the author
        const authorObjectId = toObjectId(doubt.author);
        if (authorObjectId && authorObjectId.equals(voterObjectId)) {
            throw new Error("You cannot vote on your own post.");
        }

        const upvoted = doubt.upvotes.some(id => toObjectId(id)?.equals(voterObjectId));
        const downvoted = doubt.downvotes.some(id => toObjectId(id)?.equals(voterObjectId));
        
        let updateOps = {};

        // Simplified logic to build the update operation
        if (voteType === 'up') {
            if (upvoted) { // Removing an upvote
                updateOps = { $pull: { upvotes: voterObjectId }, $inc: { voteScore: -1 } };
            } else { // Adding or switching to an upvote
                updateOps = { $addToSet: { upvotes: voterObjectId }, $pull: { downvotes: voterObjectId }, $inc: { voteScore: downvoted ? 2 : 1 } };
            }
        } else { // 'down'
            if (downvoted) { // Removing a downvote
                updateOps = { $pull: { downvotes: voterObjectId }, $inc: { voteScore: 1 } };
            } else { // Adding or switching to a downvote
                updateOps = { $addToSet: { downvotes: voterObjectId }, $pull: { upvotes: voterObjectId }, $inc: { voteScore: upvoted ? -2 : -1 } };
            }
        }
        
        console.log("[SIMPLE TEST] Executing update with ops:", JSON.stringify(updateOps));
        
        // --- THE SINGLE, ISOLATED OPERATION ---
        const updatedDoubt = await Doubt.findByIdAndUpdate(doubtObjectId, updateOps, { new: true });
        
        if (!updatedDoubt) {
            throw new Error('findByIdAndUpdate returned null. Update failed.');
        }

        console.log("[SIMPLE TEST] Update successful! New vote score:", updatedDoubt.voteScore);
        console.log("--- [SIMPLE TEST] voteOnDoubt Finished Successfully ---\n");
        
        return updatedDoubt;

    } catch (error) {
        // If this block runs, we will finally see the TRUE error.
        console.error("\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("!!!!! SIMPLE TEST FAILED !!!!!");
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
        console.error("[SIMPLE TEST] Raw Error Object:", error);
        console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n");
        throw new Error('Could not process vote. Check server logs for the specific error.');
    }
};




/**
 * Handles voting on an answer and manages Aura transactions.
 * --- REFACTORED FOR ATOMICITY AND CORRECTNESS ---
 */
export const voteOnAnswer = async (voterId, answerId, voteType) => {
    try {
        const voterObjectId = toObjectId(voterId);
        const answerObjectId = toObjectId(answerId);

        if (!voterObjectId || !answerObjectId) {
            throw new Error(`Invalid ID provided. Voter: ${voterId}, Answer: ${answerId}`);
        }
        
        const answer = await Answer.findById(answerObjectId).lean();
        if (!answer) throw new Error('Answer not found.');
        
        const authorObjectId = toObjectId(answer.author);
        if (authorObjectId && authorObjectId.equals(voterObjectId)) {
            throw new Error("You cannot vote on your own answer.");
        }

        const upvoted = answer.upvotes.some(id => toObjectId(id)?.equals(voterObjectId));
        const downvoted = answer.downvotes.some(id => toObjectId(id)?.equals(voterObjectId));
        
        let updateOps = {}, auraChangeForAuthor = 0, auraChangeForVoter = 0;

        if (voteType === 'up') {
            if (upvoted) {
                updateOps = { $pull: { upvotes: voterObjectId }, $inc: { voteScore: -1 } };
                auraChangeForAuthor = -10;
            } else {
                updateOps = { $addToSet: { upvotes: voterObjectId }, $pull: { downvotes: voterObjectId }, $inc: { voteScore: downvoted ? 2 : 1 } };
                auraChangeForAuthor = downvoted ? 10 + 2 : 10;
                if (downvoted) auraChangeForVoter = 1;
            }
        } else { // 'down'
            if (downvoted) {
                updateOps = { $pull: { downvotes: voterObjectId }, $inc: { voteScore: 1 } };
                auraChangeForAuthor = 2;
                auraChangeForVoter = 1;
            } else {
                updateOps = { $addToSet: { downvotes: voterObjectId }, $pull: { upvotes: voterObjectId }, $inc: { voteScore: upvoted ? -2 : -1 } };
                auraChangeForAuthor = upvoted ? -2 - 10 : -2;
                auraChangeForVoter = -1;
            }
        }
        
        const updatedAnswer = await Answer.findByIdAndUpdate(answerObjectId, updateOps, { new: true });
        if (!updatedAnswer) throw new Error('Answer update failed.');

        try {
            const auraSourceType = voteType === 'up' ? 'answer_upvote' : 'answer_downvote';
            if (auraChangeForAuthor !== 0) {
                await User.updateOne({ _id: authorObjectId }, { $inc: { aura: auraChangeForAuthor } });
                const authorTransaction = new AuraTransaction({ userId: authorObjectId, points: auraChangeForAuthor, source: { type: auraSourceType, id: answerObjectId }, reason: `Vote change on your answer.` });
                await authorTransaction.save();
            }
            if (auraChangeForVoter !== 0) {
                await User.updateOne({ _id: voterObjectId }, { $inc: { aura: auraChangeForVoter } });
                const voterTransaction = new AuraTransaction({ userId: voterObjectId, points: auraChangeForVoter, source: { type: auraSourceType, id: answerObjectId }, reason: `Vote cost/refund for answer.` });
                await voterTransaction.save();
            }
        } catch (auraError) {
            console.error(`CRITICAL: Vote on answer ${answerObjectId} succeeded, but Aura update failed.`, auraError);
        }

        return updatedAnswer;

    } catch (error) {
        console.error("Error in voteOnAnswer:", error);
        throw new Error('Could not process vote.');
    }
};