
import { Router } from "express";
import { AuthController } from "../controllers/auth_controller";
import { requireAuth } from "../middleware/require_auth_middleware";
import { AuthService } from "../service/auth_service";

export function createAuthRoutes(
  controller: AuthController,
  authService: AuthService,
) {
  
  const router = Router();

  router.get("/google", controller.startGoogleOAuth);
  router.get("/google/callback", controller.googleCallback);
  router.get("/me", requireAuth(authService), controller.me);
  router.post("/logout", controller.logout);

  return router;
}
