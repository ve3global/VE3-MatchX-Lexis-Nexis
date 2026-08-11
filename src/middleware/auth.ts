import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logSecurityEvent } from '../lib/securityLog.js';

declare module 'express-serve-static-core' {
  interface Request {
    client?: { id: string; clientId: string; name: string };
  }
}

type Reason = 'missing_token' | 'invalid_token' | 'token_expired' | 'token_revoked';

function reject(req: Request, res: Response, reason: Reason, clientId?: string): void {
  logSecurityEvent({
    event: 'auth_rejected',
    reason,
    clientId,
    correlationId: req.correlationId,
  });
  // `message` matches the doc's own 401 body verbatim; `reason` is a
  // replica-only additive field (see constitution.md) for the team's tests.
  res.status(401).json({ message: 'Unauthenticated', reason });
}

export async function auth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header('authorization');
    if (!header) {
      reject(req, res, 'missing_token');
      return;
    }

    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      reject(req, res, 'invalid_token');
      return;
    }

    const accessToken = await prisma.accessToken.findUnique({
      where: { token },
      include: { client: true },
    });

    if (!accessToken) {
      reject(req, res, 'invalid_token');
      return;
    }

    if (accessToken.revokedAt) {
      reject(req, res, 'token_revoked', accessToken.client.clientId);
      return;
    }

    if (accessToken.expiresAt.getTime() < Date.now()) {
      reject(req, res, 'token_expired', accessToken.client.clientId);
      return;
    }

    req.client = {
      id: accessToken.client.id,
      clientId: accessToken.client.clientId,
      name: accessToken.client.name,
    };
    next();
  } catch (error) {
    next(error);
  }
}
