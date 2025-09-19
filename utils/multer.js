import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadImage } from './cloudinary.js';
// Storage configuration using existing uploads directory
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Use existing uploads directory with subdirectories
    let uploadPath = 'uploads/';
    
    if (file.mimetype.startsWith('image/')) {
      uploadPath += 'images/';
    } else if (file.mimetype.startsWith('video/')) {
      uploadPath += 'videos/';
    } else if (file.mimetype === 'application/pdf') {
      uploadPath += 'documents/';
    } else {
      uploadPath += 'others/';
    }


    // Create subdirectory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random number
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExtension = path.extname(file.originalname);
    const fileName = file.fieldname + '-' + uniqueSuffix + fileExtension;
    cb(null, fileName);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'application/pdf': true,
    'text/plain': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Basic multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 5 // Maximum 5 files
  }
});

// Memory storage for temporary file handling
const memoryUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB for memory storage
    files: 3
  }
});
// Specific configurations for different use cases
const configurations = {
   
  // Single file upload
  single: upload.single('file'),
  
  // Multiple files with same field name
  multiple: upload.array('files', 5),
  none: upload.none(),
  // Multiple files with different field names
  fields: upload.fields([
    { name: 'image', maxCount: 2 },
    { name: 'qb', maxCount: 6 },
   { name: 'ai', maxCount: 3 }, // use this
   { name: 'stemImage', maxCount: 1 },

    { name: 'cAnswerImage', maxCount: 1 },
  

    { name: 'dAnswerImage', maxCount: 1 },

    
    { name: 'documents', maxCount: 8 },
   { name: 'topic', maxCount: 6 }
  ]),
  
  // Any files
  any: upload.any(),
  
  // Memory storage
  memory: memoryUpload.single('file'),
  
  // Image only upload
  imageOnly: multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only images are allowed'), false);
      }
    },
    limits: {
      fileSize: 2 * 1024 * 1024 // 2MB for images
    }
  }).single('image')
};

// Error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error(err);
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ error: 'File too large' });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({ error: 'Too many files' });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ error: 'Unexpected file field' });
      default:
        return res.status(400).json({ error: 'Upload error: ' + err.message });
    }
  } else if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
};

export {
  upload,
  memoryUpload,
  configurations,
  handleMulterError,
  storage
};