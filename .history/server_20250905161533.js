import dotenv from 'dotenv';
dotenv.config();

import { userDb, academicDb } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT || 5000;

// Validate environment variables
const requiredEnvVars = [
  'MONGODB_URI_USER',
  'MONGODB_URI_ACADEMIC',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'JWT_SECRET',
  'SESSION_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error('Missing required environment variables:', missingEnvVars);
  process.exit(1);
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown() {
  console.log('Received shutdown signal, shutting down gracefully...');
  
  try {
    await userDb.close();
    await academicDb.close();
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}