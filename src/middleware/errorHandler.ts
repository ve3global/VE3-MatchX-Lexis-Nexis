import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { mapZodError, type FieldErrorCodeMap } from '../lib/validation.js';

export class ValidationError extends Error {
  constructor(
    public zodError: ZodError,
    public codeMap: FieldErrorCodeMap,
  ) {
    super('ValidationError');
  }
}

/** Carries a pre-built status/body for business-rule failures (not-found, duplicate, etc.) discovered outside Zod. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super('ApiError');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ValidationError) {
    const body = mapZodError(err.zodError, err.codeMap);
    res.status(422).json(body);
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json(err.body);
    return;
  }

  console.error(
    JSON.stringify({
      correlationId: req.correlationId,
      error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    }),
  );
  res.status(500).json({
    message: 'Internal server error',
    correlationId: req.correlationId,
  });
}
