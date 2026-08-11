import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const SAMPLE_CLIENT_ID = 'demo-client';
const SAMPLE_CLIENT_SECRET = 'demo-secret-change-me';

async function main(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const clientSecretHash = await bcrypt.hash(SAMPLE_CLIENT_SECRET, 10);

    const client = await tx.client.upsert({
      where: { clientId: SAMPLE_CLIENT_ID },
      update: {},
      create: {
        clientId: SAMPLE_CLIENT_ID,
        clientSecretHash,
        name: 'Demo Client',
      },
    });

    const scorecard = await tx.scorecard.upsert({
      where: { clientId_name: { clientId: client.id, name: 'AML Standard' } },
      update: {},
      create: {
        clientId: client.id,
        name: 'AML Standard',
        passThreshold: 80,
        failThreshold: 40,
        groups: [
          {
            group_name: 'identity',
            min_score: 50,
            rules: [
              { attribute: 'address_verified', match_score: 30, no_match_score: -30 },
              { attribute: 'dob_count', match_score: 30, no_match_score: -30 },
            ],
          },
          {
            group_name: 'screening',
            min_score: 50,
            rules: [
              { attribute: 'sanction', match_score: -100, no_match_score: 20 },
              { attribute: 'pep', match_score: -50, no_match_score: 20 },
            ],
          },
        ],
      },
    });

    await tx.reportType.upsert({
      where: { clientId_name: { clientId: client.id, name: 'Standard AML Check' } },
      update: {},
      create: {
        clientId: client.id,
        name: 'Standard AML Check',
        description: 'Default AML screening report type seeded for local development.',
        scorecardId: scorecard.id,
        primaryActions: [
          'address-verification',
          'dob-verification',
          'sanction-screening',
          'pep-screening',
        ],
        secondaryActions: [],
      },
    });
  });

  console.log('Seed complete.');
  console.log(`  client_id:     ${SAMPLE_CLIENT_ID}`);
  console.log(`  client_secret: ${SAMPLE_CLIENT_SECRET}`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed, transaction rolled back:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
