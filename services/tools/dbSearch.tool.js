import CreativeQuestion from '../../models/creativeQuestion.model.js';
// import McqQuestion from '../../models/mcqQuestion.model.js'; // Uncomment if you have an MCQ model
import logger from '../../utils/logger.js';

/**
 * @file Tool for searching questions directly in the database.
 */

/**
 * Formats database search results into a readable string for the user.
 * @param {Array<object>} results - Array of question documents from the DB.
 * @returns {string} A formatted string of results.
 */
const formatResults = (results) => {
  if (!results || results.length === 0) {
    return "I couldn't find any questions matching your search criteria in the database.";
  }
  
  const formatted = results.slice(0, 3).map((q, index) => { // Limit to 3 results to keep chat clean
    return `Result ${index + 1}:\n**Stem:** ${q.stem}\n**Part (c):** ${q.c}\n**Source:** ${q.board || 'N/A'} Board, ${q.year}`;
  }).join('\n\n---\n\n');
  
  return `I found a few questions related to your search:\n\n${formatted}`;
};

/**
 * Searches the database for questions based on keywords.
 * Corresponds to the 'search_question' intent.
 * Note: This requires a text index on the relevant fields in your MongoDB collection.
 * e.g., db.creativequestions.createIndex({ stem: "text", c: "text", d: "text" })
 * 
 * @param {object} params
 * @param {object} params.parameters - The parameters extracted by the intent chain (e.g., { keywords: "..." }).
 * @returns {Promise<AsyncGenerator<object>>} A stream containing the formatted search results.
 */
const handleSearch = async ({ parameters }) => {
  const { keywords } = parameters;
  logger.info(`[DB Search Tool] Searching for questions with keywords: "${keywords}"`);

  // Use an async generator to maintain a consistent streaming interface.
  async function* resultStream() {
    try {
      if (!keywords) {
        yield { text: "Please provide some keywords to search for a question." };
        return;
      }

      const results = await CreativeQuestion.find(
        { $text: { $search: keywords } },
        { score: { $meta: "textScore" } }
      ).sort({ score: { $meta: "textScore" } }).limit(5).lean();

      const responseText = formatResults(results);
      yield { text: responseText };

    } catch (error) {
      logger.error(`[DB Search Tool] Error searching database:`, error);
      yield { text: "I'm sorry, I encountered an error while searching for questions. Please check the system configuration." };
    }
  }

  return resultStream();
};

export const dbSearchTool = {
  handleSearch,
};