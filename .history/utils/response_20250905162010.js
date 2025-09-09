export const successResponse = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    ...(data && { data })
  });
};

export const errorResponse = (res, statusCode, message, error = null) => {
  const response = {
    success: false,
    message
  };
  
  if (error) {
    response.error = error;
  }
  
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    response.stack = error.stack;
  }
  
  return res.status(statusCode).json(response);
};