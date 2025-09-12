import { Server } from "socket.io";
import logger from "../utils/logger.js";
import * as authService  from "../services/auth.service.js"; // Corrected import
// import { ragService } from "../services/rag.service.js"; // REMOVED
import { intentService } from "../services/intent.service.js"; // ADDED
import { chatMemoryService } from "../services/chatMemory.service.js";
import { authenticateSocket } from "../middlewares/auth.js";
import { sessionMiddleware } from "../app.js";
import passport from "../config/passport.js";

export const initializeSocketServer = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: [process.env.CLIENT_URL , "http://localhost:8080" , 'https://preview--wisdom-spark-ai.lovable.app', process.env.PRODUCTION_CLIENT_URL],
      methods: ["GET", "POST"],
       credentials: true
    },
  });

  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  // Session + Passport
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

      if (!content || !content.text) {
        socket.emit("chat_error", { message: "Invalid message payload. 'content.text' is required." });
        return;
      }
      
      try {
        if (!chatId) {
          const newChat = await chatMemoryService.createNewChat({ userId: socket.user.userId, query:content.text });
          chatId = newChat._id.toString(); 
          socket.emit("chat_session_created", { chatId: chatId });
          socket.join(chatId);
          logger.info(`Socket ${socket.id} auto-joined new chat room: ${chatId}`);
        }

        await chatMemoryService.saveMessage({
          chatId,
          sender: 'user',
          content,
        });

        // 2. Start the INTENT pipeline (this is the key change)
        const stream = await intentService.generateResponseStream({
          query: content.text,
          chatId,
          userId: socket?.user
        });

        let fullResponse = "";
        // 3. Stream the response back to the client (no changes here)
        for await (const chunk of stream) {
            const text = chunk?.text || ""; 
            if (text) {
                socket.emit("chat_token", { chatId, token: text });
                fullResponse += text;
            }
        }
        
        // 4. Save the full AI response to the database
        if (fullResponse) {
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