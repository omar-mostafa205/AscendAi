export declare function ensureUserProfile(input: {
    id: string;
    email: string;
    name?: string | null;
    avatarUrl?: string | null;
}): Promise<void>;
