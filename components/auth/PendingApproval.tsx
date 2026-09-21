"use client";

import { useRouter } from "next/navigation";
import { Clock3, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

export function PendingApproval({ email }: { email?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase?.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center">
        <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-warning-soft">
          <Clock3 className="h-5 w-5 text-warning" />
        </div>
        <h1 className="text-[17px] font-semibold text-text-primary">
          Waiting for approval
        </h1>
        <p className="mt-2 text-[13px] text-text-secondary">
          {email ? <>Your account ({email}) has</> : "Your account has"} been
          created but hasn&apos;t been approved yet. An admin needs to review
          your request and assign you a role before you can access the
          dashboard.
        </p>
        <button
          onClick={handleSignOut}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-page"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );
}