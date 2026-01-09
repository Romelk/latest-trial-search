FROM node:22-slim AS builder
WORKDIR /app

# Install dependencies based on the lockfile and package.json
COPY package*.json ./
RUN npm install

# Copy the rest of the app and build
COPY . .
RUN npm run build

# Production image
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app ./

# Install only production dependencies
RUN npm install --omit=dev

EXPOSE 3000
CMD ["npm", "start"]
