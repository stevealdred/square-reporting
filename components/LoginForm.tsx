"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-zinc-900/40 p-8 text-center shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">
          Entra ID
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-100">
          Square Advanced Reporting
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sign in with your organization&apos;s SSO to open the reporting
          builder.
        </p>

        {error && (
          <p
            className="mt-4 rounded-md border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-left text-sm text-rose-200"
            role="alert"
          >
            {error === "AccessDenied"
              ? "Your organization is not authorized to use this app. Sign in with an approved work account or contact your administrator."
              : `Sign-in failed (${error}). Contact your Entra ID administrator if this continues.`}
          </p>
        )}

        <button
          type="button"
          onClick={() =>
            signIn("microsoft-entra-id", { callbackUrl, redirect: true })
          }
          className="mt-6 w-full rounded-md bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
        >
          Continue with SSO
        </button>

        <p className="mt-4 text-xs text-zinc-500">
          SSO only — no password sign-in on this page.
        </p>
      </div>
    </main>
  );
}
