import type { PrismaClient } from "../../../generated/prisma/client.js";
import axios from "axios";
import { requiredEnv } from "../utils/require.js";
import type { Redis } from "ioredis";

export class SlackService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis?: Redis
  ) {}

  async getConnection(userId: string) {
    return this.prisma.slackConnections.findUnique({
      where: { user_id: userId },
      select: { team_name: true, connected_at: true },
    });
  }

  async getOAuthUrl(state: string) {
    const clientId = requiredEnv("SLACK_CLIENT_ID");
    const redirectUri = requiredEnv("SLACK_REDIRECT_URI");
    const scopes = "chat:write,chat:write.public";

    return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=${state}`;
  }

  async handleCallback(userId: string, code: string) {
    const clientId = requiredEnv("SLACK_CLIENT_ID");
    const clientSecret = requiredEnv("SLACK_CLIENT_SECRET");
    const redirectUri = requiredEnv("SLACK_REDIRECT_URI");

    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    if (!response.data.ok) {
      throw new Error(`Slack OAuth failed: ${response.data.error}`);
    }

    const { access_token, team, incoming_webhook } = response.data;

    await this.prisma.slackConnections.upsert({
      where: { user_id: userId },
      update: {
        bot_token_encrypted: access_token,
        team_id: team?.id,
        team_name: team?.name,
        alert_channel_id: incoming_webhook?.channel_id || null,
      },
      create: {
        user_id: userId,
        bot_token_encrypted: access_token,
        team_id: team?.id,
        team_name: team?.name,
        alert_channel_id: incoming_webhook?.channel_id || null,
      },
    });

    return response.data;
  }

  async sendNotification(userId: string, message: string) {
    const connection = await this.prisma.slackConnections.findUnique({
      where: { user_id: userId },
    });

    if (!connection || !connection.bot_token_encrypted) {
      return;
    }

    await axios.post(
      "https://slack.com/api/chat.postMessage",
      {
        channel: connection.alert_channel_id || "general",
        text: message,
      },
      {
        headers: {
          Authorization: `Bearer ${connection.bot_token_encrypted}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  async sendRateLimitNotification(senderId: string, userId: string, retryAt: number) {
    if (!this.redis) return;

    const hourWindow = Math.floor(Date.now() / 3_600_000);
    const lockKey = `slack-notify-lock:{${senderId}}:rate-limit:${hourWindow}`;


    const acquired = await this.redis.set(lockKey, "1", "PX", 3_600_000, "NX");
    if (!acquired) return;

    const sender = await this.prisma.senders.findUnique({
      where: { id: senderId },
    });

    const retryDate = new Date(retryAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
    const message = `*Rate Limit Reached* \nSender *${sender?.email}* has exhausted its hourly quota.\nNext retry available at: *${retryDate}* (IST)`;

    await this.sendNotification(userId, message);
  }
}
