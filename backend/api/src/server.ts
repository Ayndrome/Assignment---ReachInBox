import "dotenv/config";
import * as expressNamespace from "express";
const express = (expressNamespace as any).default || expressNamespace;
import type { Request, Response } from "express";
import { prisma } from "../../lib/prisma.js";


const app = express();
app.use(express.json());

app.get("/health", async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", database: "connected" });
  } catch {
    res.status(503).json({ status: "error", database: "disconnected" });
  }
});

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
