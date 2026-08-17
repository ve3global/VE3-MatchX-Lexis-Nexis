#  BUILD STAGE
FROM public.ecr.aws/docker/library/node:20-alpine AS builder
 
WORKDIR /app
 
# Prisma's query engine needs a real OpenSSL lib on Alpine, or it silently
# picks the wrong target and fails at runtime with a garbled engine error
RUN apk add --no-cache openssl
 
# Dummy DB URL for prisma generate — it only reads schema.prisma, never connects
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"
 
COPY package.json package-lock.json* ./
 
# Install dependencies
RUN npm install
 
# Prisma
COPY prisma ./prisma
RUN npx prisma generate
 
# App source
COPY tsconfig.json ./
COPY src ./src
 
# Build TS → JS (tsconfig's rootDir "." preserves the src/ prefix under dist/)
RUN npm run build
 
 
# RUNTIME STAGE
FROM public.ecr.aws/docker/library/node:20-alpine
 
WORKDIR /app
ENV NODE_ENV=production
 
# Same OpenSSL requirement as the builder stage — this is what actually
# runs the query engine at request time
RUN apk add --no-cache openssl
 
# Copy package files
COPY package.json package-lock.json* ./
 
# Install prod deps ONLY — includes the `prisma` CLI (a real dependency,
# needed below to run migrations). Native modules like bcrypt need their
# own install scripts to run (hence no --ignore-scripts); package.json's
# "prepare": "husky || true" is what tolerates husky being a devDependency
# this install omits.
RUN npm install --omit=dev && npm cache clean --force
 
# tsx is a devDependency (skipped above) but is needed to run the seed
# script directly from its TS source (`npm run seed`), which this image
# supports as an opt-in `docker exec`, not part of the automatic CMD
RUN npm install -g tsx
 
# Prisma schema + migrations + seed script (seed.ts is run via tsx, not compiled)
COPY prisma ./prisma
 
# Prisma client generated during the build
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
 
# Compiled app (entry point ends up at dist/src/server.js — see tsconfig's rootDir)
COPY --from=builder /app/dist ./dist
 
EXPOSE 3000
 
# Apply pending migrations, then start. Seeding is intentionally NOT run
# automatically here — it's a dev/test convenience (`npm run seed`), not
# something to run unconditionally on every container boot.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]