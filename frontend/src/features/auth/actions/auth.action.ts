import { supabase } from "@/lib/supabase";

type OAuthProvider = "google" | "github";

function handleError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function getRedirectUrl() {
  return typeof window !== "undefined"
    ? `${window.location.origin}/auth/callback`
    : undefined;
}

export async function signIn(
  email: string,
  password: string
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  handleError(error);
}

export async function signUp (email : string , password : string){
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });
  handleError(error);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  handleError(error);
}

export async function signInWithOAuth(
  provider: OAuthProvider
): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: getRedirectUrl(),
    },
  });

  handleError(error);
}
export const signInWithGoogle = () => signInWithOAuth("google");
export const signInWithGithub = () => signInWithOAuth("github");