import { Router } from "express";
import { DeliveryController } from "../controllers/delivery_controller.js";
import { AuthService } from "../service/auth_service.js";
import { requireAuth } from "../middleware/require_auth_middleware.js";

export function createDeliveryRoutes(
  controller: DeliveryController,
  authService: AuthService,
) {
  const router = Router();

  router.get("/search", requireAuth(authService), controller.search);
  router.post("/reindex", requireAuth(authService), controller.reindex);

  return router;
}
