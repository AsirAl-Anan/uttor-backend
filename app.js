// backend/src/app.js

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import morgan from 'morgan';
import passport from './config/passport.js';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import { errorHandler, notFound } from './middlewares/error.js';

// ===== MODIFICATION START: Import path and fs for file handling =====
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
// ===== MODIFICATION END =====

const app = express();
app.set('trust proxy', 1);
app.use(helmet());

app.use(cors({
  origin:[ process.env.FRONTEND_URL ,'http://localhost:8080' , 'https://preview--wisdom-spark-ai.lovable.app', process.env.PRODUCTION_CLIENT_URL],
  credentials: true
}));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());

// ===== MODIFICATION START: Setup static file serving for /uploads =====
// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the path to the uploads directory
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure the uploads directory exists, create it if it doesn't
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`Created uploads directory at: ${uploadsDir}`);
}

// Serve files from the 'uploads' directory statically
app.use('/uploads', express.static(uploadsDir));
// ===== MODIFICATION END =====


export const sessionMiddleware = session({
  name: "session",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ 
    mongoUrl: process.env.MONGODB_URI_USER,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
});

app.use(sessionMiddleware);

app.use(passport.initialize());
app.use(passport.session());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.use(notFound);
app.use(errorHandler);

export default app;