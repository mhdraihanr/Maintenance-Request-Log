import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth as defaultAuth } from "../middleware/auth";
import { idParamSchema } from "../schemas/params.schema";
import {
  createRequestSchema,
  listQuerySchema,
  updateRequestSchema,
} from "../schemas/request.schema";
import { requestService } from "../services/request.service";
import { parseOrThrow, readJson } from "../utils/validation";

export type RequestRouteDeps = {
  service: Pick<
    typeof requestService,
    "list" | "create" | "getById" | "update"
  >;
  // Disuntik supaya tes bisa memakai sesi palsu tanpa menyentuh Postgres.
  auth: () => MiddlewareHandler;
};

export const makeRequestRoutes = (deps: RequestRouteDeps): Hono => {
  const routes = new Hono();

  // Semua endpoint di sini butuh sesi. Dipasang sekali, bukan per route.
  routes.use("*", deps.auth());

  routes.get("/", async (c) => {
    const query = parseOrThrow(
      listQuerySchema,
      Object.fromEntries(new URL(c.req.url).searchParams),
    );

    const result = await deps.service.list(c.get("user"), query);
    return c.json({ data: result.items, meta: result.meta });
  });

  routes.post("/", async (c) => {
    const body = parseOrThrow(createRequestSchema, await readJson(c.req.raw));
    const created = await deps.service.create(c.get("user"), body);
    return c.json({ data: created }, 201);
  });

  routes.get("/:id", async (c) => {
    const { id } = parseOrThrow(idParamSchema, c.req.param());
    const request = await deps.service.getById(c.get("user"), id);
    return c.json({ data: request });
  });

  routes.patch("/:id", async (c) => {
    const { id } = parseOrThrow(idParamSchema, c.req.param());
    const body = parseOrThrow(updateRequestSchema, await readJson(c.req.raw));
    const updated = await deps.service.update(c.get("user"), id, body);
    return c.json({ data: updated });
  });

  return routes;
};

export const requestRoutes = makeRequestRoutes({
  service: requestService,
  auth: () => defaultAuth(),
});
