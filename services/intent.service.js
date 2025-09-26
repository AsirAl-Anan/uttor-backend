// backend/src/services/intent.service.js
import { llmNonStreaming } from '../llm/geminiClient.js';
import { intentChain, generateVoiceMessageChain } from '../llm/chains/intent.chain.js';
import { textToSpeechLLM } from '../llm/geminiClient.js';
import { ragTool } from './tools/rag.tool.js';
import { dbSearchTool } from './tools/dbSearch.tool.js';
import { examTool } from './tools/exam.tool.js';
import logger from '../utils/logger.js';
import { chatMemoryService } from './chatMemory.service.js';

const voiceMessageTool = {
  handleGenerateVoiceMessage: async ({ parameters, userId }) => {
    try {
        const { topic, voice_preference: voicePreference } = parameters;
        logger.info(`[Voice Message Tool] Handling request for topic: "${topic}" with voice preference: "${voicePreference}"`);

        if (!topic) {
            throw new Error("Topic is required to generate a voice message.");
        }

        return await generateVoiceMessageChain.invoke({
            topic,
            voicePreference,
            userId
        });
    } catch (error) {
        logger.error('[Voice Message Tool] Error executing voice message generation pipeline:', error);
        const errorScript = "I'm sorry, I encountered an error while trying to create that voice message. Please try again later.";
        return await textToSpeechLLM({ script: errorScript, voiceName: 'Zephyr' });
    }
  }
};

async function* bufferToStream(buffer) {
    yield { audio: buffer, type: 'audio' };
}

const generateResponseStream = async ({ query, images, chatId, userId }) => {
  try {
    const chat_history = await chatMemoryService.getHistory(chatId);
    logger.info(`[Intent Service] Fetched ${chat_history.length} messages for context.`);

    const intentQuery = query || (images && images.length > 0 ? "analyze the provided image" : "");
    logger.info(`[Intent Service] Classifying intent for query: "${intentQuery}" with history.`);
    
    const classification = await intentChain.invoke({ query: intentQuery, chat_history });
    
    // ======================== THE DEFINITIVE FIX ========================
    // If images were provided in this turn and the intent is to create an exam,
    // we must manually inject the image URL into the parameters because the
    // text-only intent chain would have missed it.
    if (images && images.length > 0 && classification.intent === 'create_exam') {
        logger.info(`[Intent Service] Injecting image_url from current message into exam parameters.`);
        classification.parameters.image_url = images[0]; // Use the first image
    }
    // ====================================================================
    
    logger.info(`[Intent Service] Classified intent: ${classification.intent}`, classification.parameters);

    switch (classification.intent) {
      case 'search_question':
        return await dbSearchTool.handleSearch({ parameters: classification.parameters });
      
      case 'create_exam':
        // Now, the parameters object correctly contains the image_url if it was provided.
        return await examTool.handleCreateExam({ parameters: classification.parameters, userId, chat_history });

      case 'GENERATE_VOICE_MESSAGE':
        const audioBuffer = await voiceMessageTool.handleGenerateVoiceMessage({ 
            parameters: classification.parameters, 
            userId 
        });
        return bufferToStream(audioBuffer);

      case 'understand':
      case 'solve_question':
      default:
        if (classification.intent === 'unknown') {
            logger.warn(`[Intent Service] Intent was 'unknown', defaulting to RAG pipeline.`);
        }
        return await ragTool.handleRag({ query, images, chatId, userId });
    }
  } catch (error) {
    logger.error('[Intent Service] Error during intent classification or routing:', error);
    async function* errorStream() {
      yield { text: "I'm sorry, I'm having trouble understanding your request right now. Could you please rephrase it?" };
    }
    return errorStream();
  }
};

export const intentService = {
  generateResponseStream,
};