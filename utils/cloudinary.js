import { v2 as cloudinary } from 'cloudinary';
import { createHash } from 'crypto';

/**
 * Initialize Cloudinary with environment variables
 */
function initializeCloudinary() {
  const requiredEnvVars = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
  
  // Validate required environment variables
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, // Use HTTPS URLs
    sign_url: true, // Enable URL signing for security
  });

  console.log('✅ Cloudinary configured successfully');
}

/**
 * Setup global error handling for Cloudinary operations
 */
function setupErrorHandling() {
  process.on('unhandledRejection', (reason, promise) => {
    if (reason?.message?.includes('cloudinary')) {
      console.error('🚨 Cloudinary unhandled rejection:', reason);
    }
  });
}

/**
 * Upload image with optimizations and transformations
 */
async function uploadImage(file, options = {}) {
  try {
    const {
      folder = '',
      quality = 'auto:best',
      // ... other options
    } = options;

    let fileInput;

    if (Buffer.isBuffer(file)) {
        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder, quality, resource_type: 'image' },
                (error, result) => {
                    if (error) {
                        console.error('❌ Cloudinary stream upload error:', error);
                        return reject({ success: false, error: error.message });
                    }
                    resolve({
                        success: true,
                        data: {
                            publicId: result.public_id,
                            url: result.secure_url,
                            width: result.width,
                            height: result.height,
                            format: result.format,
                            size: result.bytes,
                            createdAt: result.created_at,
                        },
                    });
                }
            );
            uploadStream.end(file);
        });
    } 
    else if (typeof file === 'string') {
      fileInput = file; // Local file path
    } else if (file?.buffer) { // For files from multer (has mimetype and buffer)
      fileInput = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } else if (file?.path) {
      fileInput = file.path; // Multer disk storage
    } else {
      throw new Error('Invalid file input. Expected file path, buffer, or multer file object.');
    }

    const result = await cloudinary.uploader.upload(fileInput, { folder, quality, resource_type: 'image' });

    return {
      success: true,
      data: {
        publicId: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        createdAt: result.created_at,
      },
    };

  } catch (error) {
    if (error.success === false) return error;
    
    console.error('❌ Cloudinary upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Upload video with compression and optimization
 */
async function uploadVideo(file, options = {}) {
  try {
    const {
      folder = 'videos',
      quality = 'auto',
      videoCodec = 'auto',
      tags = [],
      publicId,
      overwrite = false,
    } = options;

    let fileInput;
    if (typeof file === 'string') {
      fileInput = file;
    } else if (file?.buffer) {
      fileInput = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } else if (file?.path) {
      fileInput = file.path;
    } else if (Buffer.isBuffer(file)) {
      fileInput = file;
    } else {
      throw new Error('Invalid file input. Expected file path, buffer, or multer file object.');
    }

    const uploadOptions = {
      folder,
      quality,
      video_codec: videoCodec,
      tags: Array.isArray(tags) ? tags : [tags],
      resource_type: 'video',
      overwrite,
      use_filename: true,
      unique_filename: !publicId,
      ...(publicId && { public_id: publicId }),
    };

    const result = await cloudinary.uploader.upload(fileInput, uploadOptions);
    
    return {
      success: true,
      data: {
        publicId: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        format: result.format,
        size: result.bytes,
        createdAt: result.created_at,
      },
    };
  } catch (error) {
    console.error('❌ Cloudinary video upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}


/**
 * Upload sound file (.mp3, .wav, etc.) with optimizations.
 * Note: Cloudinary treats audio files as a 'video' resource type, which allows for
 * audio-specific transformations and processing.
 */
async function uploadSound(file, options = {}) {
  try {
    const {
      folder = 'sounds',
      quality = 'auto',
      audioCodec = 'auto',
      tags = [],
      publicId,
      overwrite = false,
    } = options;

    const uploadOptions = {
      folder,
      quality,
      audio_codec: audioCodec,
      tags: Array.isArray(tags) ? tags : [tags],
      resource_type: 'video', // IMPORTANT: Audio files use the 'video' resource type
      overwrite,
      use_filename: true,
      unique_filename: !publicId,
      ...(publicId && { public_id: publicId }),
    };

    if (Buffer.isBuffer(file)) {
        // ===== MODIFICATION START =====
        // For raw WAV buffers from Gemini, we must remove the audio_codec option
        // and can optionally provide the format.
        delete uploadOptions.audio_codec;
        uploadOptions.format = 'wav';
        // ===== MODIFICATION END =====

      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('❌ Cloudinary audio stream upload error:', error);
              return reject({ success: false, error: error.message });
            }
            resolve({
              success: true,
              data: {
                publicId: result.public_id,
                url: result.secure_url,
                duration: result.duration,
                format: result.format,
                size: result.bytes,
                createdAt: result.created_at,
              },
            });
          }
        );
        uploadStream.end(file);
      });
    }
    
    let fileInput;
    if (typeof file === 'string') {
      fileInput = file;
    } else if (file?.buffer) {
      fileInput = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    } else if (file?.path) {
      fileInput = file.path;
    } else {
      throw new Error('Invalid file input for sound upload. Expected file path, buffer, or multer file object.');
    }

    const result = await cloudinary.uploader.upload(fileInput, uploadOptions);

    return {
      success: true,
      data: {
        publicId: result.public_id,
        url: result.secure_url,
        duration: result.duration,
        format: result.format,
        size: result.bytes,
        createdAt: result.created_at,
      },
    };

  } catch (error) {
    if (error.success === false) return error;
    
    console.error('❌ Cloudinary audio upload error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate optimized image URL with transformations
 */
function generateImageUrl(publicId, transformations = {}) {
  try {
    const {
      width,
      height,
      crop = 'fill',
      quality = 'auto:best',
      format = 'auto',
      gravity = 'auto',
      effect,
      background,
    } = transformations;

    const transformationArray = [
      { quality, fetch_format: format },
      ...(width && height ? [{ width, height, crop, gravity }] : []),
      ...(effect ? [{ effect }] : []),
      ...(background ? [{ background }] : []),
    ].filter(Boolean);

    return cloudinary.url(publicId, {
      transformation: transformationArray,
      secure: true,
    });
  } catch (error) {
    console.error('❌ Error generating image URL:', error);
    return null;
  }
}

/**
 * Delete resource from Cloudinary
 */
async function deleteResource(publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });

    return {
      success: result.result === 'ok',
      data: result,
    };
  } catch (error) {
    console.error('❌ Cloudinary delete error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get resource details and metadata
 */
async function getResourceDetails(publicId, resourceType = 'image') {
  try {
    const result = await cloudinary.api.resource(publicId, {
      resource_type: resourceType,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('❌ Error fetching resource details:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * List resources in a folder with pagination
 */
async function listResources(options = {}) {
  try {
    const {
      folder,
      resourceType = 'image',
      maxResults = 50,
      nextCursor,
      sortBy = 'created_at',
      direction = 'desc',
    } = options;

    const searchOptions = {
      resource_type: resourceType,
      max_results: maxResults,
      sort_by: [[sortBy, direction]],
      ...(nextCursor && { next_cursor: nextCursor }),
      ...(folder && { prefix: folder }),
    };

    const result = await cloudinary.search
      .expression(folder ? `folder:${folder}` : '*')
      .with_field('context')
      .with_field('tags')
      .sort_by(sortBy, direction)
      .max_results(maxResults)
      .execute();

    return {
      success: true,
      data: {
        resources: result.resources,
        nextCursor: result.next_cursor,
        totalCount: result.total_count,
      },
    };
  } catch (error) {
    console.error('❌ Error listing resources:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Generate signed upload URL for client-side uploads
 */
function generateSignedUploadUrl(options = {}) {
  try {
    const {
      folder = 'uploads',
      tags = [],
      transformation = [],
      eager = [],
    } = options;

    const timestamp = Math.round(new Date().getTime() / 1000);
    
    const params = {
      timestamp,
      folder,
      tags: Array.isArray(tags) ? tags.join(',') : tags,
      ...(transformation.length && { transformation }),
      ...(eager.length && { eager }),
    };

    // Remove undefined values
    Object.keys(params).forEach(key => {
      if (params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    });

    const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET);

    return {
      success: true,
      data: {
        url: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
        params: {
          ...params,
          signature,
          api_key: process.env.CLOUDINARY_API_KEY,
        },
      },
    };
  } catch (error){
    console.error('❌ Error generating signed upload URL:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Batch delete resources
 */
async function batchDelete(publicIds, resourceType = 'image') {
  try {
    const result = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
    });

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    console.error('❌ Batch delete error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Health check for Cloudinary connection
 */
async function healthCheck() {
  try {
    await cloudinary.api.ping();
    return { success: true, message: 'Cloudinary connection healthy' };
  } catch (error) {
    console.error('❌ Cloudinary health check failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Initialize Cloudinary configuration on module load
 */
function initialize() {
  initializeCloudinary();
  setupErrorHandling();
}

// Initialize when module is imported
initialize();

// Export all functions
export {
  uploadImage,
  uploadVideo,
  uploadSound, // <-- Added new function to exports
  generateImageUrl,
  deleteResource,
  getResourceDetails,
  listResources,
  generateSignedUploadUrl,
  batchDelete,
  healthCheck,
  initialize,
};