import { Server } from "socket.io";
import logger from "../utils/logger.js";
import * as authService  from "../services/auth.service.js"; // Corrected import
import { ragService } from "../services/rag.service.js";
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

  // Middleware for JWT Authentication
  // io.use((socket, next) => {
  //   const token = socket.handshake.auth.token || socket.handshake.query.token;
  //   const user = authService.verifySocketToken(token);
  //   if (user) {
  //     socket.user = user;
  //     next();
  //   } else {
  //     next(new Error("Authentication error"));
  //   }
  // });
  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);

  // Session + Passport
  io.use(wrap(sessionMiddleware));
  io.use(wrap(passport.initialize()));
  io.use(wrap(passport.session()));
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    logger.info(`User connected: ${socket.id}, userId: ${socket.user.userId}`);

    // This event is still useful for re-joining an existing chat room when a user re-opens the app
    socket.on("join_chat", (chatId) => {
      socket.join(chatId);
      logger.info(`Socket ${socket.id} joined chat room: ${chatId}`);
    });
    
    socket.on("chat_message", async (data) => {
      // Use 'let' because chatId can be reassigned if it's a new chat
      let { chatId, content } = data; 

      // We only require content.text. chatId can be null for a new chat.
      if (!content || !content.text) {
        socket.emit("chat_error", { message: "Invalid message payload. 'content.text' is required." });
        return;
      }
      
      try {
        // --- NEW CHAT LOGIC ---
        if (!chatId) {
          const newChat = await chatMemoryService.createNewChat({ userId: socket.user.userId, query:content.text });
          chatId = newChat._id.toString(); // Reassign to the newly created ID

          // Immediately inform the client of the new chat session ID
          socket.emit("chat_session_created", { chatId: chatId });
          
          // Automatically join the room for the new chat
          socket.join(chatId);
          logger.info(`Socket ${socket.id} auto-joined new chat room: ${chatId}`);
        }
        // --- END NEW CHAT LOGIC ---

        // 1. Save user's message using the (potentially new) chatId
        await chatMemoryService.saveMessage({
          chatId,
          sender: 'user',
          content,
        });

        // 2. Start the RAG pipeline
        const stream = await ragService.generateResponseStream({
          query: content.text,
          chatId,
          userId: socket?.user
        });

        let fullResponse = "";
        // 3. Stream the response back to the client
        for await (const chunk of stream) {
            // LangChain can sometimes send empty chunks
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