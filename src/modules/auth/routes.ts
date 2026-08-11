import { Router } from 'express';
import { ValidationError } from '../../middleware/errorHandler.js';
import { TOKEN_REQUEST_ERROR_CODES, tokenRequestSchema } from './schema.js';
import { InvalidCredentialsError, issueToken, revokeTokens } from './service.js';

export const authRouter = Router();

authRouter.post('/oauth/token', async (req, res, next) => {
  const parsed = tokenRequestSchema.safeParse(req.body);
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
