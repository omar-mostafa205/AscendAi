"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUserProfile = ensureUserProfile;
const database_1 = require("../../config/database");
async function ensureUserProfile(input) {
    await database_1.prisma.user.upsert({
        where: { id: input.id },
        update: {
            email: input.email,
            name: input.name ?? undefined,
            avatarUrl: input.avatarUrl ?? undefined,
        },
        create: {
            id: input.id,
            email: input.email,
            name: input.name ?? undefined,
            avatarUrl: input.avatarUrl ?? undefined,
        },
    });
}
//# sourceMappingURL=ensure-profile.js.map