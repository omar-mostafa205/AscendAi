import { z } from "zod";
export declare const envSchema: z.ZodObject<{
    NODE_ENV: z.ZodEnum<{
        production: "production";
        development: "development";
        test: "test";
    }>;
    PORT: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    FRONTEND_URL: z.ZodString;
    SENTRY_DSN: z.ZodOptional<z.ZodString>;
    SUPABASE_URL: z.ZodString;
    SUPABASE_SERVICE_ROLE_KEY: z.ZodString;
    DATABASE_URL: z.ZodString;
    GEMINI_LIVE_MODEL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    GEMINI_API_KEY: z.ZodString;
    GEMINI_MODEL: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    GEMINI_API_VERSION: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    REDIS_URL: z.ZodString;
}, z.core.$strip>;
export declare const env: {
    NODE_ENV: "production" | "development" | "test";
    PORT: number;
    FRONTEND_URL: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
    DATABASE_URL: string;
    GEMINI_LIVE_MODEL: string;
    GEMINI_API_KEY: string;
    GEMINI_MODEL: string;
    GEMINI_API_VERSION: string;
    REDIS_URL: string;
    SENTRY_DSN?: string | undefined;
};
export declare const config: {
    isProduction: boolean;
    isDevlopment: boolean;
};
