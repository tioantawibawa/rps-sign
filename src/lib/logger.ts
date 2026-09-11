import pino from "pino";

/**
 * Structured logger. Sensitive fields are redacted. Never log document
 * contents or signature binaries.
 */
const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "password",
      "passwordHash",
      "*.password",
      "*.passwordHash",
      "token",
      "*.token",
      "verificationToken",
      "signatureData",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[redacted]",
  },
  base: { app: "rps-sign" },
});

/** Create a child logger bound to a correlation id. */
export function withCorrelation(correlationId: string) {
  return logger.child({ correlationId });
}

export { logger };
