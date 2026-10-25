import { Router } from "express";
import { SenderController } from "../controllers/sender_controller.js";
import { AuthService } from "../service/auth_service.js";
import { requireAuth } from "../middleware/require_auth_middleware.js";

export function createSenderRoutes(
  controller: SenderController,
  authService: AuthService,
) {
  const router = Router();

  router.post("/", requireAuth(authService), controller.create);
  router.get("/", requireAuth(authService), controller.list);

  return router;
}
