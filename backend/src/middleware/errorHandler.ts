import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[ERROR]', err);

  // PostgreSQL specific error handling
  if (err.code === '23505') {
    // Unique violation
    res.status(400).json({
      success: false,
      message: 'A record with the specified unique field already exists.',
      detail: err.detail
    });
    return;
  }

  if (err.code === '23503') {
    // Foreign key violation
    res.status(400).json({
      success: false,
      message: 'Referenced foreign record does not exist or is constrained.',
      detail: err.detail
    });
    return;
  }

  if (err.code === '23514') {
    // Check constraint violation
    res.status(400).json({
      success: false,
      message: 'Data constraint violation. Ensure values conform to allowed limits.',
      detail: err.detail
    });
    return;
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};
