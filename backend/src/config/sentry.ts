import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import logger from "../config/logger"
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not set, Sentry disabled');
    return;
  }

  const isProduction = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: isProduction ? 0.1 : 1.0,
    profilesSampleRate: isProduction ? 0.1 : 1.0,  
    debug: process.env.NODE_ENV === 'development',
    attachStacktrace: true,
    enabled: isProduction,
    
    integrations: [
      nodeProfilingIntegration(),
      Sentry.googleGenAIIntegration(),
    ],
    
  });
};

export default  Sentry ;