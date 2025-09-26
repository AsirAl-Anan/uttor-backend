// backend/src/llm/chains/ocr.chain.js

import { RunnableSequence } from "@langchain/core/runnables";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { HumanMessage } from "@langchain/core/messages";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm } from "../geminiClient.js"; // This must be a multimodal model like gemini-1.5-flash

/**
 * @description
 * This system prompt instructs the multimodal LLM to act as a dedicated OCR engine.
 * It is crucial to be highly specific to prevent the model from adding any conversational
 * filler, explanations, or markdown formatting. The goal is a raw text output.
 */
const systemPrompt = `You are an expert Optical Character Recognition (OCR) service. Your sole purpose is to accurately extract and transcribe all the text present in the given image. Do not add any commentary, explanations, or formatting like "Here is the text from the image:". Only return the raw, transcribed text. If the image contains no text, return an empty string.`;

/**
 * @description
 * A helper function that takes the input object from the chain's invocation
 * and formats it into the multimodal HumanMessage structure that the prompt template expects.
 * @param {{ image_url: string }} input - The input object containing the image URL.
 * @returns {Array<HumanMessage>} An array containing a single HumanMessage object.
 */
const createOcrMessage = ({ image_url }) => {
    if (!image_url) {
        throw new Error("Input to ocrChain must include an 'image_url' property.");
    }

    const content = [
        {
            type: "image_url",
            image_url: image_url,
        },
        {
            // Adding a minimal text part can reinforce the instruction,
            // though the system prompt is the primary driver.
            type: "text",
            text: "Please extract the text from this image."
        }
    ];

    return [new HumanMessage({ content })];
};

/**
 * @description
 * Defines the prompt structure for the OCR task. It combines the specific
 * system instructions with a placeholder for the human message containing the image.
 */
const ocrPrompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    new MessagesPlaceholder("human_message_with_image"),
]);

/**
 * @description
 * An OCR chain designed to extract text from a single image.
 * It takes an object with an `image_url` and returns the extracted text as a string.
 *
 * @example
 * const extractedText = await ocrChain.invoke({
 *   image_url: "https://example.com/path/to/image.png"
 * });
 */
export const ocrChain = RunnableSequence.from([
    // Step 1: Prepare the input for the prompt template.
    // The prompt template expects an object with a `human_message_with_image` key.
    // We create this key by running our `createOcrMessage` function on the initial input.
    {
        human_message_with_image: (input) => createOcrMessage(input),
    },

    // Step 2: The prompt template is populated with the system prompt and the
    // dynamically created human message containing the image.
    ocrPrompt,

    // Step 3: The multimodal LLM processes the complete prompt.
    llm,

    // Step 4: The StringOutputParser extracts the text content from the LLM's
    // response, ensuring the final output is a clean string.
    new StringOutputParser(),
]);