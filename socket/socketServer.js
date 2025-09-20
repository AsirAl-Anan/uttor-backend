// backend/src/socketServer.js

import { Server } from "socket.io";
import logger from "../utils/logger.js";
import { intentService } from "../services/intent.service.js";
import { chatMemoryService } from "../services/chatMemory.service.js";
import { authenticateSocket } from "../middlewares/auth.js";
import { sessionMiddleware } from "../app.js";
import passport from "../config/passport.js";
import { uploadImage, uploadSound } from "../utils/cloudinary.js";

export const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [process.env.CLIENT_URL , "http://localhost:8080" , 'https://preview--wisdom-spark-ai.lovable.app', process.env.PRODUCTION_CLIENT_URL],
      methods: ["GET", "POST"],
      credentials: true
    },
    maxHttpBufferSize: 25e6 // Increased buffer size for up to 5 images (5MB each)
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

      // Check if content exists and has either text or images
      if (!content || (!content.text?.trim() && (!content.images || content.images.length === 0))) {
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

        // ==================== MODIFICATION START ====================
        // This block is updated to handle an array of images.

        let imageUrls = [];
        // Check for the 'images' property, ensure it's an array, and it's not empty.
        if (content.images && Array.isArray(content.images) && content.images.length > 0) {
            logger.info(`Received ${content.images.length} image(s) for chat ${chatId}. Uploading to Cloudinary...`);
            
            // Loop through each image buffer sent from the client
            for (const imageBuffer of content.images) {
                if (Buffer.isBuffer(imageBuffer)) {
                    const uploadResult = await uploadImage(imageBuffer);

                    if (uploadResult.success && uploadResult.data.url) {
                        imageUrls.push(uploadResult.data.url);
                        logger.info(`Image uploaded successfully: ${uploadResult.data.url}`);
                    } else {
                        logger.error(`A Cloudinary upload failed: ${uploadResult.error}`);
                        // Optionally, inform the user about the specific failure and stop.
                        socket.emit("chat_error", { message: "Sorry, I couldn't process one of your images. Please try again." });
                        return; // Stop processing if any image fails
                    }
                }
            }
        }
        // ===================== MODIFICATION END =====================

        await chatMemoryService.saveMessage({
          chatId,
          sender: 'user',
          content: {
            text: content.text || "",
            images: imageUrls, // Save the array of URLs
          },
        });

        const stream = await intentService.generateResponseStream({
          query: content.text,
          images: imageUrls, // Pass the array of URLs to the service
          chatId,
          userId: socket?.user
        });

        let fullResponse = "";
        let audioMessageHandled = false;

        for await (const chunk of stream) {
            if (chunk && chunk.type === 'audio' && Buffer.isBuffer(chunk.audio)) {
                logger.info(`Received audio buffer for chat ${chatId}. Uploading to Cloudinary...`);
                const uploadResult = await uploadSound(chunk.audio, { folder: 'voice-messages' });

                if (uploadResult.success && uploadResult.data.url) {
                    const audioUrl = uploadResult.data.url;
                    logger.info(`Voice message uploaded to Cloudinary: ${audioUrl}`);
                    
                    await chatMemoryService.saveMessage({
                        chatId,
                        sender: 'ai',
                        content: { text: "Here is the voice message you requested.",  audio: audioUrl, }
                    });

                    socket.emit("audio_message", { chatId, audio: audioUrl });
                    audioMessageHandled = true;
                    break; 

                } else {
                    logger.error(`Cloudinary audio upload failed: ${uploadResult.error}`);
                    socket.emit("chat_error", { message: "Sorry, I couldn't generate the voice message." });
                }

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