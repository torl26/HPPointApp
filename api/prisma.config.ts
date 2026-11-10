import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Next.js と同じ .env.local から DATABASE_URL を読む
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: env("DATABASE_URL") },
});