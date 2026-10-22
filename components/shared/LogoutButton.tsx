"use client";

import { LogOut } from "lucide-react";

type LogoutButtonProps = {
  redirectTo: string;
  role: "RESTAURANT_ADMIN" | "SUPER_ADMIN" | "CAPTAIN";
  className?: string;
  showLabel?: boolean;
};

export default function LogoutButton({
  redirectTo,
  role,
  className,
  showLabel = false,
}: LogoutButtonProps) {
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    } finally {
      window.location.replace(redirectTo);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void logout()}
      aria-label="Sign out"
      title="Sign out"
      className={className}
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      {showLabel ? <span>Sign Out</span> : null}
      <span className="sr-only">Sign out</span>
    </button>
  );
}
