import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
  }
}

const HEADER = 'x-request-id';

export function correlationId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  req.correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.correlationId);
  next();
}
