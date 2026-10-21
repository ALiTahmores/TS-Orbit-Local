# STAGE 1: Build Phase
FROM node:24-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependenvies cleanly
RUN npm ci

# Copy codebase
COPY . .

# Build the client SPA and Esbuild TypeScript server
RUN npm run build

# STAGE 2: Runner Phase
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV ALLOW_NETWORK_ACCESS=true
ENV APP_ORIGIN=http://127.0.0.1:3000
ENV DATA_DIR=/app/data

# Copy manifests and final outputs from builder state
COPY package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts/start.mjs /app/scripts/account.mjs /app/scripts/database.mjs /app/scripts/paths.mjs ./scripts/

# Install production dependencies only to shrink image size
RUN npm ci --omit=dev

EXPOSE 3000

# Run the compiled Server.cjs entry point
CMD ["node", "scripts/start.mjs"]
