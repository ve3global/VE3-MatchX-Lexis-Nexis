# =========================
# BUILD STAGE
# =========================
FROM public.ecr.aws/docker/library/node:20-alpine AS builder

WORKDIR /app

# Prisma requires OpenSSL
RUN apk add --no-cache openssl

# Used only by prisma generate.
# Prisma does not connect to the database during generate.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public"

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install all dependencies because TypeScript, Prisma CLI,
# and other build tools are devDependencies.
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy TypeScript configuration and application source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript application
RUN npm run build


# =========================
# RUNTIME STAGE
# =========================
FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

# Prisma query engine requires OpenSSL
RUN apk add --no-cache openssl

# Copy dependency manifests
COPY package.json package-lock.json ./

# Remove development-only Husky prepare hook.
# Husky is a devDependency and is not present in the production install.
RUN npm pkg delete scripts.prepare \
    && npm ci --omit=dev \
    && npm cache clean --force

# Prisma CLI is required at runtime because the existing deployment
# flow runs `prisma migrate deploy` when the container starts.
RUN npm install --no-save prisma@5.20.0

# tsx is required for the existing optional seed workflow.
RUN npm install -g tsx

# Copy Prisma schema, migrations and seed
COPY prisma ./prisma

# Copy Prisma Client generated in builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy compiled application
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/src/server.js"]