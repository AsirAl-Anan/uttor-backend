import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import { userDb, academicDb } from './config/db.js';
import app from './app.js';
import { initializeSocketServer } from './socket/socketServer.js';
import logger from './utils/logger.js';

const PORT = process.env.PORT || 5000;

// Validate environment variables
const requiredEnvVars = [
  'MONGODB_URI_USER',
  'MONGODB_URI_ACADEMIC',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'JWT_SECRET',
  'SESSION_SECRET',
  'GEMINI_API_KEY' // Added for Gemini
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  logger.error('Missing required environment variables:', missingEnvVars.join(', '));
  process.exit(1);
}

// Create an HTTP server from the Express app
const httpServer = http.createServer(app);

// Initialize the Socket.IO server and attach it to the HTTP server
const io = initializeSocketServer(httpServer);

// Make the io instance available to the rest of the app (e.g., in controllers)
app.set('io', io);

// Start server
const server = httpServer.listen(PORT, () => {
  logger.info(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful shutdown
const signals = ['SIGTERM', 'SIGINT'];

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // Stop accepting new connections
  server.close(async () => {
    logger.info('HTTP server closed.');

    try {
      // Close socket.io connections
      io.close(); 
      logger.info('Socket.IO connections closed.');

      // Close database connections
      await Promise.all([userDb.close(), academicDb.close()]);
      logger.info('Database connections closed.');

      logger.info('Graceful shutdown complete. Process terminated.');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after a timeout
  setTimeout(() => {
    logger.error('Could not close connections in time, forcing shutdown.');
    process.exit(1);
  }, 10000); // 10 seconds
}

signals.forEach(signal => {
  process.on(signal, () => gracefulShutdown(signal));
});