# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies first (for better layer caching)
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application with proper type checking
RUN npm run build:prod

# ---

# Production stage
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Create app directory
RUN mkdir -p /app/dist /app/node_modules

# Copy from build stage
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/node_modules /app/node_modules
COPY package*.json ./

# Set environment variables
ENV NODE_ENV=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Run the application
CMD ["node", "dist/main.js"]
