import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

export const ACCESS_TOKEN_TTL_SECONDS = 1800;

export class InvalidCredentialsError extends Error {}

export interface IssuedToken {
  tokenType: 'Bearer';
  expiresIn: number;
  accessToken: string;
}

async function authenticateClient(clientId: string, clientSecret: string) {
  const client = await prisma.client.findUnique({ where: { clientId } });
  if (!client) {
    throw new InvalidCredentialsError();
  }

  const secretMatches = await bcrypt.compare(clientSecret, client.clientSecretHash);
  if (!secretMatches) {
    throw new InvalidCredentialsError();
  }

  return client;
}

export async function issueToken(clientId: string, clientSecret: string): Promise<IssuedToken> {
  const client = await authenticateClient(clientId, clientSecret);

  const accessToken = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000);

  await prisma.accessToken.create({
    data: {
      token: accessToken,
      clientId: client.id,
      expiresAt,
    },
  });

  return {
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    accessToken,
  };
}

/** Replica-only extension (see constitution.md) — no equivalent in the doc. */
export async function revokeTokens(clientId: string, clientSecret: string): Promise<number> {
  const client = await authenticateClient(clientId, clientSecret);

  const result = await prisma.accessToken.updateMany({
    where: { clientId: client.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return result.count;
}
