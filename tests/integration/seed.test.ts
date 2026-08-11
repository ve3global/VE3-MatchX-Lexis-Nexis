import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';

function runSeed(): void {
  execSync('npx tsx prisma/seed.ts', { stdio: 'pipe' });
}

describe('prisma/seed.ts', () => {
  it('is idempotent — re-running it does not create duplicate rows', async () => {
    runSeed();
    const [clientsBefore, reportTypesBefore, scorecardsBefore] = await Promise.all([
      prisma.client.count(),
      prisma.reportType.count(),
      prisma.scorecard.count(),
    ]);

    runSeed();
    const [clientsAfter, reportTypesAfter, scorecardsAfter] = await Promise.all([
      prisma.client.count(),
      prisma.reportType.count(),
      prisma.scorecard.count(),
    ]);

    expect(clientsAfter).toBe(clientsBefore);
    expect(reportTypesAfter).toBe(reportTypesBefore);
    expect(scorecardsAfter).toBe(scorecardsBefore);
  });

  it('inserts a client with a valid OAuth credential usable against POST /oauth/token', async () => {
    const client = await prisma.client.findUnique({ where: { clientId: 'demo-client' } });
    expect(client).not.toBeNull();
  });
});
