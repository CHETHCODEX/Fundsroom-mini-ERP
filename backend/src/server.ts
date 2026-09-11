import express, { Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { testDbConnection } from './config/db';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

// Enable CORS for frontend client
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple request logger
app.use((req: Request, res: Response, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`);
  });
  next();
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'FundsRoom Mini ERP + CRM Backend API'
  });
});

// Mount all API routes
app.use('/api', apiRouter);

// 404 Not Found fallback handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `API endpoint '${req.method} ${req.originalUrl}' does not exist.`
  });
});

// Global error handling middleware
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 FundsRoom Mini ERP + CRM Backend API is running!`);
  console.log(`📡 Port: ${PORT}`);
  console.log(`🌐 Base URL: http://localhost:${PORT}/api`);
  console.log(`🩺 Health check: http://localhost:${PORT}/api/health`);
  console.log(`=======================================================`);

  // Verify database connection
  await testDbConnection();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] SIGTERM received. Closing HTTP server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed gracefully.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] SIGINT received. Closing HTTP server...');
  server.close(() => {
    console.log('[SHUTDOWN] Server closed gracefully.');
    process.exit(0);
  });
});

export default app;
