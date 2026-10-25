import { Router } from "express";
import { SlackController } from "../controllers/slack_controller.js";
import { AuthService } from "../service/auth_service.js";
import { requireAuth } from "../middleware/require_auth_middleware.js";

export function createSlackRoutes(
  controller: SlackController,
  authService: AuthService,
) {
  const router = Router();

  router.get("/connect", requireAuth(authService), controller.startOAuth);
  router.get("/callback", requireAuth(authService), controller.callback);
  router.get("/status", requireAuth(authService), controller.getConnection);

  return router;
}
