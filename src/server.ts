import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';

const app = createApp();

prisma
  .$connect()
  .then(() => {
    console.log('Database connected');
  })
  .catch((error) => {
    console.error('Database connection failed:', error);
    process.exit(1);
  });

app.listen(env.port, () => {
  console.log(`LN Replica listening on port ${env.port}`);
});
