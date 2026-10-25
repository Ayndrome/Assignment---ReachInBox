import { Router } from "express";
import { CampaignController } from "../controllers/campaign_controller";
import { AuthService } from "../service/auth_service";
import { requireAuth } from "../middleware/require_auth_middleware";

export function createCampaignRoutes(
  controller: CampaignController,
  authService: AuthService,
) {
    
  const router = Router();

  router.post("/", requireAuth(authService), controller.create);

  return router;
}