"use client";
import Link from "next/link";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/shared/components/ui/form";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { GithubLogo, GoogleLogo } from "@/shared/components/Logos";
import { useAuthForm } from "@/features/auth/hooks/useAuthForm";

const OAUTH_PROVIDERS = [
  { provider: "google", label: "Continue with Google", Icon: GoogleLogo },
  { provider: "github", label: "Continue with Github", Icon: GithubLogo },
] as const;

const AuthForm = ({ signType }: { signType: "login" | "signup" }) => {
  const { form, error, isLoading, onSubmit, handleOAuthSignIn } =
    useAuthForm(signType);

  const isSignUp = signType === "signup";

  return (
    <div className="flex-1 flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-2xl">
      <div className="w-full max-w-md">
        <h2 className="text-2xl font-medium mb-6">AscendAI</h2>

        <h1 className="text-4xl md:text-5xl font-serif mb-4 text-foreground">
          {isSignUp ? "Sign up" : "Sign in"}
        </h1>

        <p className="text-muted-foreground mb-8">
          {isSignUp
            ? "Create an account to get started."
            : "Enter your credentials to access your account."}
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {OAUTH_PROVIDERS.map(({ provider, label, Icon }) => (
            <Button
              key={provider}
              type="button"
              variant="outline"
              onClick={() => handleOAuthSignIn(provider)}
              disabled={isLoading}
              className="w-full"
            >
              <Icon />
              {label}
            </Button>
          ))}
        </div>
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="px-2 text-muted-foreground">Or continue with</span>
          </div>
        </div>
        {error && (
          <p className="text-destructive text-sm text-center mb-4">{error}</p>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="name@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter your password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading
                ? isSignUp
                  ? "Creating account..."
                  : "Signing in..."
                : "Continue"}
            </Button>
          </form>
        </Form>

        {/* Switch between login and signup */}
        <p className="mt-6 text-muted-foreground text-sm text-center">
          {isSignUp ? "Already have an account? " : "Don't have an account? "}
          <Link
            href={isSignUp ? "/login" : "/signup"}
            className="text-foreground font-medium hover:underline"
          >
            {isSignUp ? "Sign in" : "Sign up"}
          </Link>
        </p>
      </div>
    </div>
  );
};

export default AuthForm;
