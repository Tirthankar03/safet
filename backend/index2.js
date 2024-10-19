// index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import { RegionMapService } from './utils/clustering.js';
import logger from './utils/logger.js'; // Optional but recommended

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection with retry logic
async function connectDB(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        // These are the recommended options for MongoDB 4.2+
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });
      
      logger.info('📦 Connected to MongoDB');
      return;
    } catch (err) {
      if (i === retries - 1) {
        logger.error('❌ MongoDB connection failed:', err);
        process.exit(1);
      }
      logger.warn(`MongoDB connection attempt ${i + 1} failed. Retrying...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

// Routes
const regionMapRouter = RegionMapService.getRouter();
app.use('/api/regions', regionMapRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
async function shutdown() {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
}

// Start server
const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();
  
  app.listen(PORT, () => {
    logger.info(`🚀 Server running on port ${PORT}`);
  });
}

// Handle shutdown signals
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the application
startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});

export default app;