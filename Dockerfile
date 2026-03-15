# Multi-stage build for AI Image Detector
# Stage 1: Build the frontend
FROM node:20-alpine AS build-stage
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./
RUN npm run build

# Stage 2: Production environment
FROM node:20-slim

# Install Python and all required system libraries for OpenCV and Forensic Tools
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    python3-venv \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Setup a clean Python Virtual Environment (Fixes "Externally Managed Environment" errors)
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy backend
COPY backend/package*.json ./backend/
WORKDIR /app/backend
RUN npm install --legacy-peer-deps
COPY backend/ ./

# Copy built frontend dist to the location server.js expects
COPY --from=build-stage /app/frontend/dist /app/frontend/dist

# Install Python requirements into the Virtual Environment
WORKDIR /app/backend/engine
COPY backend/engine/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Final setup
WORKDIR /app/backend
EXPOSE 8301

# Command to start the server
CMD ["node", "server.js"]
