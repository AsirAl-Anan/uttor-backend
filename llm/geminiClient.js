// backend/src/llm/geminiClient.js

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RunnableLambda } from "@langchain/core/runnables";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { GoogleGenerativeAI } from "@google/generative-ai";

// =================================================================
// SECTION 1: OFFICIAL GOOGLE SDK WRAPPER FOR GEMINI 2.5
// =================================================================

// Initialize the official Google SDK Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * This is a custom async generator function that acts as a bridge between
 * LangChain's message format and the official Google Generative AI SDK.
 * This is necessary because the LangChain library may not yet support
 * the "gemini-2.5-flash" model name for multimodal inputs.
 *
 * @param {Array<AIMessage | HumanMessage>} messages - The array of messages from a LangChain prompt.
 * @returns {AsyncGenerator<string>} A stream of text chunks from the AI model.
 */
async function* invokeGoogleSdkForStreaming(messages) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const latestMessage = messages.pop();
  const history = messages.map(msg => ({
    role: msg instanceof AIMessage ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const userParts = [];
  if (Array.isArray(latestMessage.content)) {
    for (const part of latestMessage.content) {
      if (part.type === 'text') {
        userParts.push({ text: part.text });
      } else if (part.type === 'image_url') {
        const imageDataURI = typeof part.image_url === 'string'
          ? part.image_url
          : part.image_url?.url;

        if (imageDataURI) {
          const [header, base64Data] = imageDataURI.split(',');
          const match = header ? header.match(/:(.*?);/) : null;
          
          if (match && match[1] && base64Data) {
            const mimeType = match[1];
            userParts.push({
              inlineData: { mimeType, data: base64Data },
            });
          }
        }
      }
    }
  } else {
    userParts.push({ text: latestMessage.content });
  }

  const chat = model.startChat({ history });
  const result = await chat.sendMessageStream(userParts);

  for await (const chunk of result.stream) {
    const chunkText = chunk.text();
    if (chunkText) {
      yield chunkText;
    }
  }
}

/**
 * This is our primary, multimodal LLM export.
 * It's a LangChain RunnableLambda that wraps our custom SDK function,
 * making it a "drop-in" replacement for a standard LangChain chat model.
 */
export const llm = new RunnableLambda({
  func: (input) => invokeGoogleSdkForStreaming(input.messages),
});

// =================================================================
// SECTION 2: STANDARD LANGCHAIN WRAPPERS FOR OTHER MODELS
// =================================================================

const safetySettings = [
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
];

/**
 * A non-streaming, text-only model for internal tasks like intent classification.
 */
export const llmNonStreaming = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash-lite",
  temperature: 0,
  safetySettings,
});

/**
 * A fast, streaming, text-only model for simple responses.
 */
export const fastStreamingLLM = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash-lite",
  temperature: 0,
  streaming: true,
  safetySettings,
});

// =================================================================
// SECTION 3: TEXT-TO-SPEECH (TTS) FUNCTIONALITY
// =================================================================

function parseMimeType(mimeType) {
  const [fileType, ...params] = mimeType.split(';').map(s => s.trim());
  const [_, format] = fileType.split('/');
  const options = { numChannels: 1 };
  if (format && format.startsWith('L')) {
      const bits = parseInt(format.slice(1), 10);
      if (!isNaN(bits)) {
          options.bitsPerSample = bits;
      }
  }
  for (const param of params) {
      const [key, value] = param.split('=').map(s => s.trim());
      if (key === 'rate') {
          options.sampleRate = parseInt(value, 10);
      }
  }
  return options;
}

function createWavHeader(dataLength, options) {
    const { numChannels, sampleRate, bitsPerSample } = options;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
}

/**
 * Converts text to speech using the Gemini 2.5 Flash TTS model.
 * Aggregates audio chunks into a single WAV formatted buffer.
 *
 * @param {object} params
 * @param {string} params.script - The text to be converted into speech.
 * @param {string} [params.voiceName='Aoede'] - The prebuilt voice to use.
 * @returns {Promise<Buffer>} A Buffer containing the complete audio data in WAV format.
 */
export async function textToSpeechLLM({ script, voiceName = 'Aoede' }) {
  // First, get an instance of the specific TTS model.
  const ttsModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-tts" });

  // Define the text content for the model.
  const contents = [{
    role: 'user',
    parts: [{ text: script }],
  }];

  // **THE FIX**: For TTS models using this SDK version, the special parameters 
  // must be nested inside the `generationConfig` object.
  const generationConfig = {
    responseModalities: ['audio'],
    speechConfig: {
      voiceConfig: {
        prebuiltVoiceConfig: {
          voiceName: voiceName,
        }
      }
    },
  };
  
  // Make the API call using the correct syntax: `modelInstance.generateContentStream(payload)`.
  // This solves the `TypeError: Cannot read properties of undefined (reading 'generateContentStream')`
  const responseStream = await ttsModel.generateContentStream({
    contents,
    generationConfig,
  });

  const audioChunks = [];
  let audioMimeType = null;

  // The result object from this call contains the stream.
  for await (const chunk of responseStream.stream) {
    if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
      const inlineData = chunk.candidates[0].content.parts[0].inlineData;
      if (!audioMimeType) {
        audioMimeType = inlineData.mimeType;
      }
      const buffer = Buffer.from(inlineData.data, 'base64');
      audioChunks.push(buffer);
    }
  }

  if (audioChunks.length === 0 || !audioMimeType) {
    throw new Error("TTS generation failed: No audio data received.");
  }
  
  const combinedBuffer = Buffer.concat(audioChunks);
  
  const options = parseMimeType(audioMimeType);
  const wavHeader = createWavHeader(combinedBuffer.length, options);
  const wavBuffer = Buffer.concat([wavHeader, combinedBuffer]);
  
  return wavBuffer;
}