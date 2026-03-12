"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const env_1 = require("./env");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchWithTimeoutAndRetry(input, init) {
    const timeoutMs = 30000;
    const attempts = 2;
    let lastError;
    for (let i = 0; i < attempts; i++) {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(input, { ...init, signal: controller.signal });
            clearTimeout(t);
            return res;
        }
        catch (e) {
            clearTimeout(t);
            lastError = e;
            if (i < attempts - 1)
                await sleep(250);
        }
    }
    throw lastError;
}
exports.supabaseAdmin = (0, supabase_js_1.createClient)(env_1.env.SUPABASE_URL, env_1.env.SUPABASE_SERVICE_ROLE_KEY, {
    global: { fetch: fetchWithTimeoutAndRetry },
    auth: { persistSession: false },
});
//# sourceMappingURL=supabase.js.map