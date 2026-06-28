FROM node:22-bookworm-slim

# System libraries required by Playwright's Chromium at runtime
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    libglib2.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    libnss3 \
    libnspr4 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxfixes3 \
    libdbus-1-3 \
    ca-certificates \
    fonts-liberation \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install node deps (skip playwright auto-download — we control it below)
COPY package*.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci

# Download Playwright's Chromium now that all system libs are present
RUN npx playwright install chromium

# Copy source and build
COPY . .
RUN npx prisma generate && npm run build

EXPOSE 3000
CMD ["./node_modules/.bin/next", "start", "-H", "0.0.0.0"]
