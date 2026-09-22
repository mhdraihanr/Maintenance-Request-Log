import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { auth as defaultAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { idParamSchema } from "../schemas/params.schema";
import {
  createUserSchema,
  updateUserSchema,
  userListQuerySchema,
} from "../schemas/user.schema";
import { userService } from "../services/user.service";
import { parseOrThrow, readJson } from "../utils/validation";

export type UserRouteDeps = {
  service: Pick<
    typeof userService,
    "list" | "create" | "getById" | "update" | "deactivate"
  >;
  auth: () => MiddlewareHandler;
  guard: () => MiddlewareHandler;
};

export const makeUserRoutes = (deps: UserRouteDeps): Hono => {
  const routes = new Hono();

  routes.use("*", deps.auth(), deps.guard());

  routes.get("/", async (c) => {
    const query = parseOrThrow(
      userListQuerySchema,
      Object.fromEntries(new URL(c.req.url).searchParams),
    );

    const result = await deps.service.list(query);
    return c.json({ data: result.items, meta: result.meta });
  });

  routes.post("/", async (c) => {
    const body = parseOrThrow(createUserSchema, readJson(await c.req.text()));
    const created = await deps.service.create(body);
    return c.json({ data: created }, 201);
  });

  routes.get("/:id", async (c) => {
    const { id } = parseOrThrow(idParamSchema, c.req.param());
    const user = await deps.service.getById(id);
    return c.json({ data: user });
  });

  routes.patch("/:id", async (c) => {
    const { id } = parseOrThrow(idParamSchema, c.req.param());
    const body = parseOrThrow(updateUserSchema, readJson(await c.req.text()));
    const updated = await deps.service.update(c.get("user"), id, body);
    return c.json({ data: updated });
  });

  routes.delete("/:id", async (c) => {
    const { id } = parseOrThrow(idParamSchema, c.req.param());
    await deps.service.deactivate(c.get("user"), id);
    return c.body(null, 204);
  });

  return routes;
};

export const userRoutes = makeUserRoutes({
  service: userService,
  auth: () => defaultAuth(),
  guard: () => requireRole("admin"),
});
