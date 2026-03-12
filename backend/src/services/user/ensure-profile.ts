import { prisma } from "../../config/database"

export async function ensureUserProfile(input: {
  id: string
  email: string
  name?: string | null
  avatarUrl?: string | null
}): Promise<void> {
  await prisma.user.upsert({
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
  })
}

