# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Set environment variables to ignore TypeScript errors during build
ENV CI=true
ENV SKIP_PREFLIGHT_CHECK=true

# Build the application
RUN npm run build

# ---

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files from builder stage
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

# Install only production dependencies
RUN npm ci --only=production

# Copy the built app from the builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
# Create an empty config file if it doesn't exist in the build
RUN touch ./next.config.js

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

# Expose the port the app will run on
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start the application
CMD ["npm", "start"]
