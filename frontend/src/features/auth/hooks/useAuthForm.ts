"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { signIn, signUp, signInWithOAuth } from "../actions/auth.action";

export const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: "Please enter a valid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});

export type AuthFormValues = z.infer<typeof formSchema>;

export function useAuthForm(signType: "login" | "signup") {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: AuthFormValues) {
    setError(null);
    setIsLoading(true);

    try {
      if (signType === "signup") {
        await signUp(values.email, values.password);
        setError("Check your email to confirm your account.");
        return;
      }

      await signIn(values.email, values.password);
      router.push("/jobs");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : signType === "signup"
          ? "Failed to create account."
          : "Failed to sign in."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOAuthSignIn(provider: "google" | "github") {
    setError(null);
    setIsLoading(true);
    try {
      await signInWithOAuth(provider);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to sign in with ${provider}.`
      );
    } finally {
      setIsLoading(false);
    }
  }

  return { form, error, isLoading, onSubmit, handleOAuthSignIn };
}
