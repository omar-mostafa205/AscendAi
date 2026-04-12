import * as Sentry from "@sentry/node";
import logger from "../config/logger";
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    logger.warn("SENTRY_DSN not set, Sentry disabled");
    return;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const nodeMajor = Number(process.versions.node.split(".")[0] ?? "0");
  const profilingSupported = [16, 18, 20, 22, 24].includes(nodeMajor);

  // Avoid importing @sentry/profiling-node on unsupported Node versions to prevent warnings/crashes.
  const integrations: any[] = [Sentry.googleGenAIIntegration()];
  if (profilingSupported) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { nodeProfilingIntegration } = require("@sentry/profiling-node");
      integrations.unshift(nodeProfilingIntegration());
    } catch (e) {
      logger.warn(
        "Sentry profiling integration failed to load; continuing without profiling",
        { error: e },
      );
    }
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: profilingSupported ? (isProduction ? 0.1 : 1.0) : 0,
    debug: process.env.NODE_ENV === "development",
    attachStacktrace: true,
    enabled: isProduction,

    integrations,
  });
};

export default Sentry;
