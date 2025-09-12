import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

// Centralized Gemini model client.
// This allows easy configuration changes (e.g., model name, temperature) in one place.
const safetySettings = [
  {
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_NONE",
  },
  {
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE",
  },
];
export const llm = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash", // Or another suitable model
  temperature: 0.3,
  // IMPORTANT: For streaming to work correctly.
  streaming: true, 
});
export const llmNonStreaming = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash-lite", // Or another suitable model
  temperature: 0.2,
});
export const fastStreamingLLM = new ChatGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: "gemini-2.5-flash-lite", // Or another suitable model
  temperature: 0.2,
  // IMPORTANT: For streaming to work correctly.  
  streaming: true,
});