import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { LoginForm } from "@/components/LoginForm";
import { isMainPageSsoEnabled } from "@/lib/mainPageAuth";

export default async function LoginPage() {
  if (!isMainPageSsoEnabled()) {
    redirect("/");
  }

  const session = await auth();
  if (session) {
    redirect("/");
  }

  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
          <p className="text-sm text-zinc-400">Loading sign-in…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
