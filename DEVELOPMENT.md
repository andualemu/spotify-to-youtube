# Development Guide

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running (whale icon in menu bar)
- Node.js 18+
- npm

## Setup

Install dependencies:

```bash
npm install
```

## Running the Server

**1. Start the databases**

```bash
docker compose up -d
```

**2. Start the dev server**

```bash
npm run dev
```

You should see:

```
PostgreSQL connected
Redis connected
Server listening at http://0.0.0.0:3000
```

## Testing

**Health check**

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{"status":"ok"}
```

Or open `http://localhost:3000/health` in your browser.

## Stopping

```bash
# Stop the dev server
Ctrl+C

# Stop and remove containers
docker compose down
```

## Environment Variables

Copy `.env.example` to `.env` (already done for local dev):

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the server listens on |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/spotify_to_youtube` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
