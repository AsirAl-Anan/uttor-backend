import mongoose from 'mongoose';

// User Database Connection
export const userDb = mongoose.createConnection(process.env.MONGODB_URI_USER, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

userDb.on('error', (err) => {
  console.error('User DB connection error:', err);
  process.exit(1);
});

userDb.once('open', () => {
  console.log('Connected to User Database');
});

// Academic Database Connection
export const academicDb = mongoose.createConnection(process.env.MONGODB_URI_ACADEMIC, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

academicDb.on('error', (err) => {
  console.error('Academic DB connection error:', err);
  process.exit(1);
});

academicDb.once('open', () => {
  console.log('Connected to Academic Database');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await userDb.close();
  await academicDb.close();
  console.log('MongoDB connections closed');
  process.exit(0);
});