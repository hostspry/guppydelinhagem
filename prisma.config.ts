import { defineConfig } from "prisma/config";

// dotenv é devDep — só carrega em dev local. Em prod (Docker/CapRover)
// o DATABASE_URL já vem como env var do container.
try {
  await import("dotenv/config");
} catch {
  // dotenv não disponível em prod — ok
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
