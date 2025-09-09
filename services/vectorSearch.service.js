import SubjectEmbedding from '../models/subject.embedding.model.js';
import QuestionEmbedding from '../models/question.embedding.model.js';
import logger from '../utils/logger.js';

// NOTE: This implementation relies on MongoDB Atlas Vector Search.
// You must have a vector search index configured on both collections.

/**
 * Formats the retrieved documents into a clean string for the LLM context.
 * @param {Array<object>} documents - The documents retrieved from the vector search.
 * @returns {string} A formatted context string.
 */
const formatContext = (documents) => {
  return documents
    .map((doc, i) => {
      let content = '';
      if (doc.type === 'subject') {
        content = `Source ${i + 1} (Book Content):\n${doc.chunkText}`;
      } else if (doc.type === 'question') {
        const questionDetails = doc.details;
        // Customize this based on how you want to present question context
        content = `Source ${i + 1} (Similar Question):\nStem: ${questionDetails.stem || questionDetails.question?.questiontext}\nQuestion Part C: ${questionDetails.c}\nAnswer for C: ${questionDetails.cAnswer}`;
      }
      return content;
    })
    .join('\n\n---\n\n');
};

/**
 * Performs a vector search across subject and question embeddings.
 * @param {number[]} vector - The query embedding vector.
 * @param {number} topK - The number of results to return.
 * @returns {Promise<string>} A formatted string of the retrieved context.
 */
const searchEmbeddings = async (vector, topK = 5) => {
  try {
    // Stage for subject embeddings search
    const subjectSearchStage = {
      $vectorSearch: {
        index: 'vector_index', // REPLACE with your actual index name
        path: 'embedding',
        queryVector: vector,
        numCandidates: topK * 10,
        limit: topK,
      },
    };
    const subjectProjectStage = {
      $project: {
        _id: 0,
        type: { $literal: 'subject' },
        chunkText: 1,
        score: { $meta: 'vectorSearchScore' },
      },
    };

    // Stage for question embeddings search
    const questionSearchStage = {
      $vectorSearch: {
        index: 'vector_index', // REPLACE with your actual index name
        path: 'embedding',
        queryVector: vector,
        numCandidates: topK * 10,
        limit: topK,
      },
    };
    
    // We need to fetch the actual question content after finding the embedding
    const questionLookupStages = [
      { // Lookup for Creative Questions
        $lookup: {
          from: 'creativequestions', // collection name
          localField: 'creativeQuestionId',
          foreignField: '_id',
          as: 'creativeDetails',
        }
      },
      { // Lookup for B2 Questions
        $lookup: {
          from: 'b2questions', // collection name
          localField: 'b2QuestionId',
          foreignField: '_id',
          as: 'b2Details',
        }
      },
      { // Combine the details and project
        $project: {
          _id: 0,
          type: { $literal: 'question' },
          details: { $ifNull: [ { $arrayElemAt: ['$creativeDetails', 0] }, { $arrayElemAt: ['$b2Details', 0] } ] },
          score: { $meta: 'vectorSearchScore' },
        },
      }
    ];

    // Perform searches in parallel
    const [subjectResults, questionResults] = await Promise.all([
      SubjectEmbedding.aggregate([subjectSearchStage, subjectProjectStage]),
      QuestionEmbedding.aggregate([questionSearchStage, ...questionLookupStages]),
    ]);

    const combinedResults = [...subjectResults, ...questionResults]
      .sort((a, b) => b.score - a.score) // Sort by score descending
      .slice(0, topK); // Take the top K overall results

    logger.info(`Found ${combinedResults.length} relevant documents.`);
    if (combinedResults.length === 0) {
      return '';
    }

    return formatContext(combinedResults);
  } catch (error) {
    logger.error('Error during vector search:', error);
    // Do not throw; return empty context to allow fallback
    return '';
  }
};

export const vectorSearchService = {
  searchEmbeddings,
};