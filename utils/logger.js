// A simple logger utility. In a real-world app, you might use Winston or Pino.
const logger = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`),
  error: (message, error) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error),
  warn: (message) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`),
};

export default logger;