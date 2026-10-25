
import "dotenv/config";
import * as expressNamespace from "express";
import * as corsNamespace from "cors";
import cookieParser from "cookie-parser";
import type { Request, Response } from "express";

import { prisma } from "../../lib/prisma";
import { AuthRepository } from "./repositories/auth_repository";
import { AuthService } from "./service/auth_service";
import { AuthController } from "./controllers/auth_controller";
import { createAuthRoutes } from "./routes/auth_routes";
import { CampaignRepository } from "./repositories/campaign_repository";
import { CampaignController } from "./controllers/campaign_controller";
import { CampaignService } from "./service/campaign_service";
import { createCampaignRoutes } from "./routes/campaign_routes";
import { ElasticsearchService } from "../../shared/src/elasticsearch/elasticsearch_service";
import { createDeliveryRoutes } from "./routes/delivery_routes";
import { DeliveryController } from "./controllers/delivery_controller";
import { SlackService } from "../../shared/src/slack/slack_service";
import { SlackController } from "./controllers/slack_controller";
import { createSlackRoutes } from "./routes/slack_routes";
import { SenderController } from "./controllers/sender_controller";
import { createSenderRoutes } from "./routes/sender_routes";

const express = (expressNamespace as any).default || expressNamespace;
const cors = (corsNamespace as any).default || corsNamespace;

const esService = new ElasticsearchService();
await esService.createIndexIfNotExists();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

const authRepository = new AuthRepository(prisma);
const authService = new AuthService(authRepository);
const authController = new AuthController(authService);

const campaignRepository = new CampaignRepository(prisma);
const campaignService = new CampaignService(campaignRepository);
const campaignController = new CampaignController(campaignService);

app.use("/api/v1/auth", createAuthRoutes(authController, authService));
app.use('/api/v1/campaigns', createCampaignRoutes(campaignController, authService))

const deliveryController = new DeliveryController(esService, prisma);
  app.use("/api/v1/deliveries", createDeliveryRoutes(deliveryController, authService));

  const slackService = new SlackService(prisma);
  const slackController = new SlackController(slackService);
   app.use("/api/v1/slack", createSlackRoutes(slackController, authService));

   const senderController = new SenderController(prisma);
   app.use("/api/v1/senders", createSenderRoutes(senderController, authService));
  
   app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

const port = Number(process.env.PORT ?? 4000);

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}; shutting down API...`);

  server.close(async (error: any) => {
    try {
      await prisma.$disconnect();

      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
      }
    } catch (disconnectError) {
      console.error("Database shutdown failed:", disconnectError);
      process.exitCode = 1;
    }
  });
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
