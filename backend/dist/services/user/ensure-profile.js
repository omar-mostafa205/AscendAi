"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserProfile = ensureUserProfile;
const database_1 = require("../../config/database");
// Avoid writing to the DB on every request/socket connect.
// We only create the profile if missing, and we debounce repeated ensures per-process.
const ensuredRecently = new Map();
const ENSURE_TTL_MS = 10 * 60 * 1000;
async function ensureUserProfile(input) {
    const now = Date.now();
    const last = ensuredRecently.get(input.id);
    if (last && now - last < ENSURE_TTL_MS)
        return;
    const existing = await database_1.prisma.user.findUnique({
        where: { id: input.id },
        select: { id: true, email: true, name: true, avatarUrl: true },
    });
    if (!existing) {
        await database_1.prisma.user.create({
            data: {
                id: input.id,
                email: input.email,
                name: input.name ?? undefined,
                avatarUrl: input.avatarUrl ?? undefined,
            },
        });
        ensuredRecently.set(input.id, now);
        return;
    }
    // Update only if something actually changed.
    const nextEmail = input.email;
    const nextName = input.name ?? null;
    const nextAvatar = input.avatarUrl ?? null;
    if (existing.email !== nextEmail ||
        (existing.name ?? null) !== nextName ||
        (existing.avatarUrl ?? null) !== nextAvatar) {
        await database_1.prisma.user.update({
            where: { id: input.id },
            data: {
                email: nextEmail,
                name: nextName ?? undefined,
                avatarUrl: nextAvatar ?? undefined,
            },
        });
    }
    ensuredRecently.set(input.id, now);
}
//# sourceMappingURL=ensure-profile.js.map