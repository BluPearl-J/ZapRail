FROM node:20-alpine

WORKDIR /app

# Install dependencies first (layer cache friendly)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# Data directory for SQLite / JSON store
RUN mkdir -p data

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "server.js"]
