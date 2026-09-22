import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { auth } from "../middleware/auth";
import { loginRateLimit } from "../middleware/rateLimit";
import { loginSchema } from "../schemas/auth.schema";
import { authService } from "../services/auth.service";
import { env } from "../env";
import { parseOrThrow } from "../utils/validation";

const COOKIE_NAME = "auth";
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "Lax",
  path: "/",
} as const;

export type AuthRouteDeps = {
  service: Pick<typeof authService, "login" | "profile">;
};

export const makeAuthRoutes = (deps: AuthRouteDeps): Hono => {
  const routes = new Hono();

  routes.post("/login", loginRateLimit(), async (c) => {
    const body = parseOrThrow(loginSchema, await c.req.json());
    const { user, token } = await deps.service.login(
      body.username,
      body.password,
    );

    setCookie(c, COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      maxAge: env.JWT_TTL_HOURS * 3600,
    });

    return c.json({ data: user });
  });

  routes.post("/logout", auth(), (c) => {
    deleteCookie(c, COOKIE_NAME, { path: "/" });
    return c.body(null, 204);
  });

  routes.get("/me", auth(), async (c) => {
    const user = c.get("user");
    const profile = await deps.service.profile(user.id);
    return c.json({ data: profile });
  });

  return routes;
};

export const authRoutes = makeAuthRoutes({ service: authService });
