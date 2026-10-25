# ReachInbox Full-Stack Email Scheduler

A powerful email scheduling platform with Google OAuth, Slack notifications, and Elasticsearch-backed search.

## Architecture

- **Backend**: Express 5 with TypeScript, Prisma 7 (MySQL/MariaDB).
- **Worker**: BullMQ for job processing, Redis for rate limiting and queue management.
- **Frontend**: React (Vite) with Tailwind CSS and Lucide icons.
- **Integrations**:
  - **Elasticsearch**: For high-performance searching of delivery records.
  - **Slack**: Real-time notifications for rate-limiting alerts.
  - **Google OAuth**: Secure user authentication.

## Prerequisites

- Node.js 20+
- Docker and Docker Compose
- Google OAuth Credentials
- Slack OAuth Credentials

## Environment Setup

Create a `.env` file in the `backend/` directory:

```env
# Database & Redis
DATABASE_URL="mysql://user:password@localhost:3307/reachinbox"
REDIS_URL="redis://localhost:6379"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_CALLBACK_URL="http://localhost:4000/api/v1/auth/google/callback"

# Slack OAuth
SLACK_CLIENT_ID="your-slack-client-id"
SLACK_CLIENT_SECRET="your-slack-client-secret"
SLACK_REDIRECT_URI="http://localhost:4000/api/v1/slack/callback"

# Elasticsearch
ELASTICSEARCH_NODE="http://localhost:9200"

# SMTP (Mailpit/Ethereal)
SMTP_HOST="localhost"
SMTP_PORT=1025
SMTP_USER=""
SMTP_PASSWORD=""

# App Config
FRONTEND_URL="http://localhost:5173"
PORT=4000
```

## Getting Started

1. **Start Infrastructure**:
   ```bash
   docker-compose up -d
   ```

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run dev:api
   ```

3. **Worker Setup**:
   ```bash
   cd backend
   npm run dev:worker
   ```

4. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Features

- **Google Login**: Secure authentication using Google OAuth.
- **Campaign Scheduling**: Create email campaigns with custom delays and hourly limits.
- **CSV Support**: Upload recipient lists via CSV or text files.
- **Search & Filter**: Search through sent and scheduled emails using Elasticsearch.
- **Slack Alerts**: Connect Slack to receive alerts when a sender hits their rate limit.
- **Rate Limiting**: Intelligent per-sender rate limiting with Redis.
- **Outbox Pattern**: Reliable event processing and indexing.

## Manual Testing

1. Log in via Google.
2. Add a Sender in the backend (or via a future UI).
3. Compose a new campaign, upload a CSV of emails, and set a start time.
4. Verify the campaign appears in the Dashboard.
5. Check Mailpit (`http://localhost:8025`) for delivered emails.
6. Connect Slack and trigger a rate limit to verify notifications.
7. Use the search bar to find specific deliveries.
