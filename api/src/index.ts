import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env";
import { pool } from "./db/pool";
import { requestId } from "./middleware/requestId";
import { logger } from "./middleware/logger";
import { errorHandler } from "./middleware/errorHandler";
import { authRoutes } from "./routes/auth.routes";
import { requestRoutes } from "./routes/request.routes";
import { userRoutes } from "./routes/user.routes";
import "./types";

const app = new Hono();
app.use("*", requestId());
app.use("*", logger());
app.onError(errorHandler());

app.get("/health", async (c) => {
  try {
    await pool.query("SELECT 1");
    return c.json({
      status: "ok",
      db: "up",
      uptime: process.uptime(),
    });
  } catch {
    return c.json(
      {
        status: "degraded",
        db: "down",
        uptime: process.uptime(),
      },
      503,
    );
  }
});

app.route("/api/auth", authRoutes);
app.route("/api/requests", requestRoutes);
app.route("/api/users", userRoutes);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
