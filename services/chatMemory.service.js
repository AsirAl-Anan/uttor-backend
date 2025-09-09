import { Chat } from "../models/chat.model.js";
import { Message } from "../models/message.model.js";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import logger from "../utils/logger.js";
import { generateChatName } from "./rag.service.js";
const MESSAGE_HISTORY_LIMIT = 10; // Number of recent messages to fetch for context

/**
 * Retrieves the last N messages for a given chat session.
 * @param {string} chatId - The ID of the chat session.
 * @returns {Promise<Array<HumanMessage | AIMessage>>} A list of LangChain message objects.
 */
const getHistory = async (chatId) => {
  const chat = await Chat.findById(chatId).populate({
    path: 'messages',
    options: { sort: { createdAt: -1 }, limit: MESSAGE_HISTORY_LIMIT }
  });

  if (!chat || !chat.messages) {
    return [];
  }

  // Messages are sorted descending, so reverse to get chronological order
  return chat.messages.reverse().map(msg => 
    msg.sender === 'user'
      ? new HumanMessage(msg.content.text)
      : new AIMessage(msg.content.text)
  );
};

/**
 * Saves a message to the database and links it to the chat.
 * @param {object} params
 * @param {string} params.chatId - The ID of the chat.
 * @param {'user' | 'ai'} params.sender - The sender of the message.
 * @param {object} params.content - The message content ({text, image}).
 * @returns {Promise<Message>} The saved message document.
 */
const saveMessage = async ({ chatId, sender, content }) => {
  const message = new Message({
    chat: chatId,
    sender,
    content,
  });
  await message.save();

  // Link the new message to the parent chat
  await Chat.findByIdAndUpdate(chatId, { $push: { messages: message._id } });

  return message;
};
const createNewChat = async ({ userId, query = "New Chat" }) => {
  try {
   const title =  await generateChatName({ query });
    const newChat = new Chat({
      user: userId,
      title, // Can be updated later with a summary of the first message
      messages: [],
    });
    await newChat.save();
    logger.info(`Created new chat session ${newChat._id} for user ${userId}`);
    return newChat;
  } catch (error) {
    logger.error('Error creating new chat:', error);
    throw new Error('Could not create a new chat session.');
  }
};
export const chatMemoryService = {
  getHistory,
  saveMessage,
  createNewChat
};