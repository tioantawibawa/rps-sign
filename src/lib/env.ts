import { z } from "zod";

/**
 * Centralised, validated environment access. Never read `process.env` directly
 * elsewhere. Secrets come only from the environment — never hard-coded.
 */
const booleanish = z
  .enum(["true", "false", "1", "0"])
  .transform((v) => v === "true" || v === "1");

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  AUTH_SECRET: z.string().min(16),
  AUTH_URL: z.string().url().optional(),
  AUTH_TRUST_HOST: booleanish.default("true"),

  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.storage"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY_ID: z.string().default("minioadmin"),
  S3_SECRET_ACCESS_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("rps-sign"),
  S3_FORCE_PATH_STYLE: booleanish.default("true"),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  MAIL_DRIVER: z.enum(["smtp", "console"]).default("console"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(""),
  SMTP_PASS: z.string().optional().default(""),
  SMTP_SECURE: booleanish.default("false"),
  MAIL_FROM: z.string().default("RPS Sign <no-reply@rps-sign.local>"),

  LIBREOFFICE_BIN: z.string().default("soffice"),
  CONVERTER_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  DOC_MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(26214400),
  SIGNATURE_MAX_UPLOAD_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2097152),

  RATE_LIMIT_ENABLED: booleanish.default("true"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
});

type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env = new Proxy({} as Env, {
  get: (_t, prop: string) => getEnv()[prop as keyof Env],
});
