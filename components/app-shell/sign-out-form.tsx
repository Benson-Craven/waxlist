"use client";

import { LogOut } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { AUTH_SIGN_OUT_PATH } from "@/lib/constants";
import { clearOfflineShellCaches } from "@/lib/offline/cache";
import { cn } from "@/lib/utils";

export function SignOutForm({
  className,
  buttonClassName,
  size = "default",
  iconOnly = false,
}: {
  className?: string;
  buttonClassName?: string;
  size?: "sm" | "default" | "lg";
  iconOnly?: boolean;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    // Drop the cached shell before the browser leaves the workspace so the
    // next account cannot open the previous collector's pages offline.
    await clearOfflineShellCaches();
    form.submit();
  }

  return (
    <form
      action={AUTH_SIGN_OUT_PATH}
      method="post"
      className={className}
      onSubmit={handleSubmit}
    >
      <Button
        type="submit"
        variant="outline"
        size={iconOnly ? "icon" : size}
        aria-label={iconOnly ? "Sign Out" : undefined}
        title={iconOnly ? "Sign Out" : undefined}
        className={cn(buttonClassName)}
      >
        {iconOnly ? (
          <LogOut className="size-4" aria-hidden="true" />
        ) : (
          "Sign Out"
        )}
      </Button>
    </form>
  );
}
