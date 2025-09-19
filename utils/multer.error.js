/**
 * Custom error classes for better error handling and debugging
 */

/**
 * Base custom error class
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * File processing related errors
 */
export class FileProcessingError extends AppError {
  constructor(message, filename = null) {
    super(message, 422);
    this.filename = filename;
  }
}

/**
 * AI service related errors
 */
export class AIServiceError extends AppError {
  constructor(message, aiProvider = 'unknown') {
    super(message, 503);
    this.aiProvider = aiProvider;
  }
}

/**
 * Image validation errors
 */
export class ImageValidationError extends AppError {
  constructor(message, rejectedFiles = []) {
    super(message, 400);
    this.rejectedFiles = rejectedFiles;
  }
}

/**
 * Response parsing errors
 */
export class ResponseParsingError extends AppError {
  constructor(message, rawResponse = null) {
    super(message, 502);
    this.rawResponse = rawResponse;
  }
}

/**
 * Upload service errors (Cloudinary, etc.)
 */
export class UploadServiceError extends AppError {
  constructor(message, service = 'unknown') {
    super(message, 503);
    this.service = service;
  }
}

/**
 * Create error response object for API
 * @param {Error} error - Error object
 * @param {boolean} includeStack - Whether to include stack trace (development only)
 * @returns {Object} Error response object
 */
export function createErrorResponse(error, includeStack = false) {
  const response = {
    success: false,
    message: error.message || 'An unexpected error occurred',
    timestamp: new Date().toISOString(),
  };

  // Add error type for custom errors
  if (error.name && error.name !== 'Error') {
    response.type = error.name;
  }

  // Add status code for custom errors
  if (error.statusCode) {
    response.statusCode = error.statusCode;
  }

  // Add additional error details for specific error types
  if (error instanceof FileProcessingError && error.filename) {
    response.filename = error.filename;
  }

  if (error instanceof AIServiceError && error.aiProvider) {
    response.aiProvider = error.aiProvider;
  }

  if (error instanceof ImageValidationError && error.rejectedFiles.length > 0) {
    response.rejectedFiles = error.rejectedFiles;
  }

  if (error instanceof UploadServiceError && error.service) {
    response.service = error.service;
  }

  // Include stack trace in development
  if (includeStack && error.stack) {
    response.stack = error.stack;
  }

  return response;
}

/**
 * Express error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export function errorHandler(err, req, res, next) {
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = err.statusCode || 500;
  
  const errorResponse = createErrorResponse(err, isDevelopment);
  
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper for route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped function that catches async errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}