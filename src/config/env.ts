import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET debe tener al menos 32 charcteres"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  BUSINESS_TIMEZONE: z.string().default("America/Lima"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Variables de entorno invalidas: ");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
