import fs from "fs/promises";

/**
 * Validate image upload request
 * @param {Object} req - Express request object
 * @returns {Object} Validation result with isValid flag and message
 */
export function validateImageUpload(req) {
  console.log(req.files)
  if (!req.files ) {
    return {
      isValid: false,
      message: "Please provide at least one image file",
    };
  }

  // Additional validation can be added here
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
  const invalidFiles = req.files.qb.filter(file => 
    !allowedMimeTypes.includes(file.mimetype)
  );

  if (invalidFiles.length > 0) {
    return {
      isValid: false,
      message: `Invalid file types detected. Only JPEG, PNG, WebP, and GIF files are allowed.`,
    };
  }

  return {
    isValid: true,
    message: "Valid image upload",
  };
}

/**
 * Get MIME type from file path
 * @param {string} filePath - Path to the file
 * @returns {string} MIME type
 */
export function getMimeTypeFromPath(filePath) {
  const pathParts = filePath.split(/[\\/]/);
  const fileName = pathParts[pathParts.length - 1];
  const ext = fileName.split(".").pop().split("?")[0]?.toLowerCase();

  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };

  if (mimeTypes[ext]) {
    return mimeTypes[ext];
  }

  console.warn(`Unknown extension '${ext}', defaulting to image/jpeg`);
  return 'image/jpeg';
}

/**
 * Clean up uploaded files from local storage
 * @param {Array} files - Array of file objects
 * @param {boolean} suppressErrors - Whether to suppress cleanup errors
 * @returns {Promise<void>}
 */
export async function cleanupFiles(files, suppressErrors = false) {
  if (!files || !Array.isArray(files)) {
    return;
  }

  console.log(`Cleaning up ${files.length} files...`);

  const cleanupPromises = files.map(async (file) => {
    try {
      await fs.unlink(file.path);
      console.log(`Successfully deleted: ${file.path}`);
    } catch (error) {
      const message = `Failed to delete file ${file.path}: ${error.message}`;
      
      if (suppressErrors) {
        console.warn(message);
      } else {
        console.error(message);
        throw error;
      }
    }
  });

  await Promise.all(cleanupPromises);
  console.log("File cleanup completed");
}

/**
 * Check if file exists
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file exists
 */
export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get file size in bytes
 * @param {string} filePath - Path to the file
 * @returns {Promise<number>} File size in bytes
 */
export async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    throw error;
  }
}

/**
 * Validate file size limits
 * @param {Array} files - Array of file objects
 * @param {number} maxSizeBytes - Maximum file size in bytes (default: 10MB)
 * @returns {Object} Validation result
 */
export function validateFileSizes(files, maxSizeBytes = 10 * 1024 * 1024) {
  const oversizedFiles = files.filter(file => file.size > maxSizeBytes);
  
  if (oversizedFiles.length > 0) {
    return {
      isValid: false,
      message: `Files too large. Maximum size allowed: ${Math.round(maxSizeBytes / 1024 / 1024)}MB`,
      oversizedFiles: oversizedFiles.map(f => f.originalname),
    };
  }

  return {
    isValid: true,
    message: "All files within size limits",
  };
}

/**
 * Create a safe filename by removing/replacing problematic characters
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
export function createSafeFilename(filename) {
  return filename
    .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
    .replace(/_{2,}/g, '_') // Replace multiple underscores with single
    .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
}