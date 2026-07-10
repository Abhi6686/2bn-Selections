import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import fs from "node:fs";
import { env } from "./config/env.js";
import { registerAuthRoutes } from "./routes/auth.routes.js";
import { registerUsersRoutes } from "./routes/users.routes.js";
import { registerChangeOrderRoutes } from "./routes/change-orders.routes.js";
import { registerHealthRoutes } from "./routes/health.routes.js";
import { registerLibraryRoutes } from "./routes/library.routes.js";
import { registerProjectRoutes } from "./routes/projects.routes.js";
import { registerSelectionRoutes } from "./routes/selections.routes.js";
import { registerThemeRoutes } from "./routes/themes.routes.js";
import { registerSelectionTemplateRoutes } from "./routes/selection-templates.routes.js";
import { registerRoomTypeRoutes } from "./routes/room-types.routes.js";


export async function buildApp() {

  const app = Fastify({
    logger: {
      transport: env.isDevelopment
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
  });

  await app.register(helmet, { contentSecurityPolicy: false });
  const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow: boolean) => void) => {
    if (env.isDevelopment) {
      callback(null, true);
      return;
    }
    if (!origin) {
      callback(null, true);
      return;
    }

    const cleanOrigin = origin.replace(/^https?:\/\//, "");
    const cleanWebOrigin = env.webOrigin ? env.webOrigin.replace(/^https?:\/\//, "") : "";

    if (
      cleanOrigin === cleanWebOrigin ||
      cleanOrigin.startsWith("localhost:") ||
      cleanOrigin === "localhost" ||
      cleanOrigin.endsWith(".onrender.com")
    ) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  };

  await app.register(cors, {
    origin: corsOrigin,
    methods: ["GET", "PUT", "POST", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
  });

  if (!fs.existsSync(env.uploadsDir)) {
    fs.mkdirSync(env.uploadsDir, { recursive: true });
  }

  await app.register(fastifyStatic, {
    root: env.uploadsDir,
    prefix: "/uploads/",
    decorateReply: false,
  });

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUsersRoutes(app);
  await registerLibraryRoutes(app);
  await registerProjectRoutes(app);
  await registerSelectionRoutes(app);
  await registerChangeOrderRoutes(app);
  await registerThemeRoutes(app);
  await registerSelectionTemplateRoutes(app);
  await registerRoomTypeRoutes(app);



  app.setErrorHandler((error: Error & { name?: string }, _request, reply) => {
    if (error.name === "ZodError") {
      return reply.code(400).send({ error: "Validation failed", details: error });
    }
    app.log.error(error);
    return reply.code(500).send({ error: "Internal server error" });
  });

  return app;
}
