// backend/src/socketServer.js

import { Server } from "socket.io";
import logger from "../utils/logger.js";
import { intentService } from "../services/intent.service.js";
import { chatMemoryService } from "../services/chatMemory.service.js";
import { authenticateSocket } from "../middlewares/auth.js";
import { sessionMiddleware } from "../app.js";
import passport from "../config/passport.js";
// MODIFICATION: Import uploadSound in addition to uploadImage
import { uploadImage, uploadSound } from "../utils/cloudinary.js";

export const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [process.env.CLIENT_URL , "http://localhost:8080" , 'https://preview--wisdom-spark-ai.lovable.app', process.env.PRODUCTION_CLIENT_URL],
      methods: ["GET", "POST"],
      credentials: true
    },
    maxHttpBufferSize: 5e6 
  });

  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  io.use(wrap(sessionMiddleware));
  io.use(wrap(passport.initialize()));
  io.use(wrap(passport.session()));
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.id}, userId: ${socket.user.userId}`);

    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      logger.info(`Socket ${socket.id} joined chat room: ${chatId}`);
    });
      
    socket.on("chat_message", async (data) => {
      let { chatId, content } = data; 

      if (!content || (!content.text?.trim() && !content.image)) {
        socket.emit("chat_error", { message: "Invalid message payload. Content is empty." });
        return;
      }
      
      try {
        if (!chatId) {
          const chatNameQuery = content.text || "Image Message";
          logger.info(`Creating new chat for user ${socket.user.userId} with query: "${chatNameQuery}"`);
          const newChat = await chatMemoryService.createNewChat({ userId: socket.user.userId, query: chatNameQuery });
          chatId = newChat._id.toString(); 
          socket.emit("chat_session_created", { chatId: chatId });
          socket.join(chatId);
          logger.info(`Socket ${socket.id} auto-joined new chat room: ${chatId}`);
        }

        let imageUrls = [];
        if (content.image && Buffer.isBuffer(content.image)) {
            logger.info(`Received image for chat ${chatId}. Uploading to Cloudinary...`);
            const uploadResult = await uploadImage(content.image);

            if (uploadResult.success && uploadResult.data.url) {
                imageUrls.push(uploadResult.data.url);
                logger.info(`Image uploaded successfully: ${uploadResult.data.url}`);
            } else {
                logger.error(`Cloudinary upload failed: ${uploadResult.error}`);
                socket.emit("chat_error", { message: "Sorry, I couldn't process your image. Please try again." });
                return;
            }
        }

        await chatMemoryService.saveMessage({
          chatId,
          sender: 'user',
          content: {
            text: content.text || "",
            images: imageUrls,
          },
        });

        const stream = await intentService.generateResponseStream({
          query: content.text,
          images: imageUrls,
          chatId,
          userId: socket?.user
        });

        let fullResponse = "";
        let audioMessageHandled = false;

        for await (const chunk of stream) {
            // ===== MODIFICATION START: Handle new audio chunk type =====
            if (chunk && chunk.type === 'audio' && Buffer.isBuffer(chunk.audio)) {
                logger.info(`Received audio buffer for chat ${chatId}. Uploading to Cloudinary...`);
                const uploadResult = await uploadSound(chunk.audio, { folder: 'voice-messages' });

                if (uploadResult.success && uploadResult.data.url) {
                    const audioUrl = uploadResult.data.url;
                    logger.info(`Voice message uploaded to Cloudinary: ${audioUrl}`);

                    // Save the AI's message with the audio URL to the database
                    await chatMemoryService.saveMessage({
                        chatId,
                        sender: 'ai',
                        content: { text: "Here is the voice message you requested.",  audio: audioUrl, } // Placeholder text for chat history
                       
                    });

                    // Emit a new event specifically for the audio message
                    socket.emit("audio_message", { chatId, audio: audioUrl });
                    audioMessageHandled = true;
                    break; // Audio is a complete response, so we exit the stream loop.

                } else {
                    logger.error(`Cloudinary audio upload failed: ${uploadResult.error}`);
                    socket.emit("chat_error", { message: "Sorry, I couldn't generate the voice message." });
                }

            // ===== MODIFICATION END =====
            } else if (chunk && chunk.buttons && Array.isArray(chunk.buttons)) {
                socket.emit("structured_response", { chatId, ...chunk });
                if (chunk.text) {
                    fullResponse += chunk.text;
                }
            } else {
                const text = chunk?.text ?? (typeof chunk === 'string' ? chunk : (chunk?.content ?? ""));
                if (text) {
                    socket.emit("chat_token", { chatId, token: text });
                    fullResponse += text;
                }
            }
        }
        
        // Save the full text response ONLY if it's a regular text chat (not an audio one)
        if (fullResponse && !audioMessageHandled) {
          await chatMemoryService.saveMessage({
            chatId,
            sender: 'ai',
            content: { text: fullResponse },
          });
        }

        socket.emit("chat_stream_end", { chatId });
        logger.info(`Finished streaming response for chat: ${chatId}`);

      } catch (error) {
        logger.error(`Error handling chat message for chat ${chatId || 'new chat'}:`, error);
        socket.emit("chat_error", { message: "An internal error occurred while processing your message." });
      }
    });

    socket.on("disconnect", () => {
      logger.info(`User disconnected: ${socket.id}`);
    });
  });

  logger.info("Socket.IO server initialized.");
  return io;
};