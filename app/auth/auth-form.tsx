"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import {
  signInWithEmail,
  signUpWithEmail,
  type AuthActionState,
} from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrateSource } from "@/lib/listening/sources";

const FIELD_CLASSNAME =
  "border-[#FFF4E8]/14 bg-[#FFF4E8]/7 text-[#FFF4E8]";

const ERROR_ID = "auth-form-error";

export function AuthForm({
  mode,
  source = "spotify",
  next = "/app",
}: {
  mode: "sign-in" | "sign-up";
  source?: CrateSource;
  next?: string;
}) {
  const action = mode === "sign-up" ? signUpWithEmail : signInWithEmail;
  const [state, formAction, isPending] = useActionState<
    AuthActionState,
    FormData
  >(action, null);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const isSignUp = mode === "sign-up";
  const hasError = Boolean(state?.error);

  return (
    <form action={formAction} className="mt-8 grid gap-5" noValidate>
      <input type="hidden" name="source" value={source} />
      <input type="hidden" name="next" value={next} />
      {isSignUp ? (
        <label className="grid gap-2 text-sm text-[#FFF4E8]/72" htmlFor="auth-name">
          Name
          <Input
            id="auth-name"
            name="name"
            autoComplete="name"
            autoFocus
            required
            aria-invalid={hasError || undefined}
            className={FIELD_CLASSNAME}
          />
        </label>
      ) : null}
      <label className="grid gap-2 text-sm text-[#FFF4E8]/72" htmlFor="auth-email">
        Email
        <Input
          id="auth-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus={!isSignUp}
          required
          aria-invalid={hasError || undefined}
          className={FIELD_CLASSNAME}
        />
      </label>
      <label className="grid gap-2 text-sm text-[#FFF4E8]/72" htmlFor="auth-password">
        Password
        <span className="relative block">
          <Input
            id="auth-password"
            name="password"
            type={isPasswordVisible ? "text" : "password"}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-invalid={hasError || undefined}
            aria-describedby={hasError ? ERROR_ID : undefined}
            className={`${FIELD_CLASSNAME} pr-16`}
          />
          <button
            type="button"
            onClick={() => setIsPasswordVisible((visible) => !visible)}
            aria-pressed={isPasswordVisible}
            aria-controls="auth-password"
            className="absolute inset-y-0 right-0 rounded-r-md px-3 text-xs font-medium uppercase tracking-[0.14em] text-[#FFF4E8]/58 transition hover:text-[#FFF4E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFF4E8]/40"
          >
            {isPasswordVisible ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {hasError ? (
        <p
          id={ERROR_ID}
          role="alert"
          className="rounded-xl border border-[#D34278]/24 bg-[#D34278]/10 px-4 py-3 text-sm text-[#FFD7E4]"
        >
          {state?.error}
        </p>
      ) : null}
      <Button
        type="submit"
        disabled={isPending}
        className="h-12 rounded-full bg-[#FFF4E8] text-[#05030A] hover:bg-[#f6dfc9]"
      >
        {isPending
          ? isSignUp
            ? "Creating your account…"
            : "Signing in…"
          : isSignUp
            ? "Create account"
            : "Sign in"}
      </Button>
      <p className="text-center text-sm text-[#FFF4E8]/54">
        {isSignUp ? "Already have an account?" : "New to WAXLIST?"}{" "}
        <Link
          href={{
            pathname: isSignUp ? "/auth/sign-in" : "/auth/sign-up",
            query: { source, next },
          }}
          className="text-[#FFF4E8] underline decoration-[#FFF4E8]/30 underline-offset-4"
        >
          {isSignUp ? "Sign in" : "Create account"}
        </Link>
      </p>
    </form>
  );
}
