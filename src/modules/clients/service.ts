import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../lib/prisma.js';

/** Matches prisma/seed.ts's own bcrypt cost — the only other place a Client row is created. */
const CLIENT_SECRET_HASH_ROUNDS = 10;

export interface ProvisionedClient {
  id: string;
  clientId: string;
  clientSecret: string;
  name: string;
  createdAt: Date;
}

/**
 * Replica-only extension (see constitution.md) — mints a new tenant's
 * client_id/client_secret pair on demand. Until now the only place a
 * Client row was ever created was prisma/seed.ts's hardcoded demo client;
 * this is the first runtime path. The plaintext secret is returned to the
 * caller exactly once by routes.ts — only its bcrypt hash is ever
 * persisted, same as the seed script's own convention.
 */
export async function createClient(name: string): Promise<ProvisionedClient> {
  const clientId = `client_${randomBytes(8).toString('hex')}`;
  const clientSecret = randomBytes(24).toString('hex');
  const clientSecretHash = await bcrypt.hash(clientSecret, CLIENT_SECRET_HASH_ROUNDS);

  const created = await prisma.client.create({
    data: { clientId, clientSecretHash, name },
  });

  return {
    id: created.id,
    clientId: created.clientId,
    clientSecret,
    name: created.name,
    createdAt: created.createdAt,
  };
}
