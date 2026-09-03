import { Router } from 'express';
import { ValidationError } from '../../middleware/errorHandler.js';
import { TOKEN_REQUEST_ERROR_CODES, tokenRequestSchema } from './schema.js';
import { InvalidCredentialsError, issueToken, revokeTokens } from './service.js';

export const authRouter = Router();

/**
 * A live sandbox capture (2026-09-03, planning/api-drift-remediation.md)
 * authenticated via `Authorization: Basic base64(id:secret)` + a
 * `grant_type` body field, not the JSON `{client_id, client_secret}` body
 * this endpoint otherwise expects — standard OAuth2 client-credentials
 * form. When present, Basic Auth wins over the body entirely (a stray
 * client_id/client_secret in the body alongside it is ignored, same as any
 * real OAuth2 server).
 */
function basicAuthCredentials(
  header: string | undefined,
): { client_id: string; client_secret: string } | null {
  if (!header || !/^basic /i.test(header)) {
    return null;
  }
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }
  return {
    client_id: decoded.slice(0, separatorIndex),
    client_secret: decoded.slice(separatorIndex + 1),
  };
}

authRouter.post('/oauth/token', async (req, res, next) => {
  const parsed = tokenRequestSchema.safeParse(
    basicAuthCredentials(req.headers.authorization) ?? req.body,
  );
  if (!parsed.success) {
    next(new ValidationError(parsed.error, TOKEN_REQUEST_ERROR_CODES));
    return;
  }

  try {
    const token = await issueToken(parsed.data.client_id, parsed.data.client_secret);
    res.status(200).json({
      token_type: token.tokenType,
      expires_in: token.expiresIn,
      access_token: token.accessToken,
    });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }
    next(error);
  }
});

// Replica-only extension (see constitution.md) — not part of the documented API.
authRouter.post('/oauth/token/revoke', async (req, res, next) => {
  const parsed = tokenRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    next(new ValidationError(parsed.error, TOKEN_REQUEST_ERROR_CODES));
    return;
  }

  try {
    const revoked = await revokeTokens(parsed.data.client_id, parsed.data.client_secret);
    res.status(200).json({ revoked });
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ message: 'Unauthenticated' });
      return;
    }
    next(error);
  }
});
