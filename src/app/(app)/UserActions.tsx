"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
}

interface UserActionsProps {
  user: User;
  signOutAction: () => Promise<void>;
  expanded?: boolean;
}

export default function UserActions({
  signOutAction,
  expanded = false,
}: UserActionsProps) {
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOutAction();
    } catch (error) {
      console.error("Failed to sign out:", error);
      setIsSigningOut(false);
    }
  };

  if (expanded) {
    return (
      <div className="flex flex-col items-stretch gap-0.5 w-full pt-2 border-t border-white/[0.07]">
        <Link
          href="/settings"
          className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-[400] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors">
          <Settings className="w-4 h-4 shrink-0" />
          <span className="truncate">Settings</span>
        </Link>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex items-center gap-3 h-10 px-3 rounded-xl text-sm font-[400] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          <LogOut className="w-4 h-4 shrink-0" />
          <span className="truncate">
            {isSigningOut ? "Signing out..." : "Logout"}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 pt-2 border-t border-white/[0.07]">
      <Link
        href="/settings"
        className="p-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors"
        title="Settings">
        <Settings className="w-4 h-4" />
      </Link>
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="p-2.5 rounded-xl text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sign Out">
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
}
