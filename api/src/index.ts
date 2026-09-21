import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./env";
import { pool } from "./db/pool";

const app = new Hono();

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

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});
