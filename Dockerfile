# Multi-stage build for AI Image Detector
# Stage 1: Build the frontend
FROM node:18 AS build-stage
WORKDIR /app/frontend

# Ensure we install devDependencies even if NODE_ENV is set to production
ENV NODE_ENV=development

COPY frontend/package*.json ./
RUN npm install --include=dev --legacy-peer-deps

COPY frontend/ ./
# Use npx to ensure vite is found in the local node_modules
RUN npx vite build

# Stage 2: Production environment
FROM node:18-slim

# Install Python and OpenCV dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --legacy-peer-deps
COPY backend/ ./

# Copy built frontend dist to the location server.js expects
COPY --from=build-stage /app/frontend/dist /app/frontend/dist

# Install Python requirements
WORKDIR /app/backend/engine
COPY backend/engine/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Final setup
WORKDIR /app/backend
EXPOSE 8301

# Command to start the server
CMD ["node", "server.js"]
