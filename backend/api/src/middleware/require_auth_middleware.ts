
import type { Request, Response, NextFunction } from "express";
import { AuthService } from "../service/auth_service.js";

export function requireAuth(authService: AuthService) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const token = req.cookies?.session_token;

      if (typeof token !== "string" || !token) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }

      const user = await authService.getSession(token);

      if (!user) {  
        res.status(401).json({ error: "Invalid or expired session" });
        return;
      }

      res.locals.user = user;
      next();
    } catch {
      res.status(500).json({ error: "Authentication check failed" });
    }
  };
}
