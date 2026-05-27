"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";
import { useInstall } from "./InstallContext";

// Bumped from -dismissed → -dismissed-v2 so previously-dismissed users see the
// banner again after this change. Re-show 14 days after a fresh dismiss.
const DISMISS_KEY = "cleano:install-dismissed-v2";
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Floating "Install Cleano" card. Renders if Chrome captured a
 * beforeinstallprompt or if the user is on iOS Safari (where we show
 * manual Add-to-Home-Screen instructions). Dismissible — but the user
 * can always re-install from the drawer's "Install app" entry.
 */
export default function InstallPrompt() {
  const { canInstall, isStandalone, isIOSSafari, install } = useInstall();
  const [dismissed, setDismissed] = useState(true); // start hidden until we read storage

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) {
      setDismissed(false);
      return;
    }
    const elapsed = Date.now() - Number(ts);
    setDismissed(Number.isFinite(elapsed) && elapsed < DISMISS_COOLDOWN_MS);
  }, []);

  if (isStandalone) return null;
  if (dismissed) return null;
  if (!canInstall && !isIOSSafari) return null;

  const onDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const onInstall = async () => {
    const ok = await install();
    if (ok) setDismissed(true);
  };

  return (
    <div className="cl-install-prompt" role="dialog" aria-live="polite">
      <div className="cl-install-icon">
        {isIOSSafari && !canInstall ? <Share size={18} /> : <Download size={18} />}
      </div>
      <div className="cl-install-body">
        <strong>Install Cleano</strong>
        <span>
          {canInstall
            ? "Add Cleano to your phone for the full app experience."
            : "Tap Share, then Add to Home Screen."}
        </span>
      </div>
      <div className="cl-install-actions">
        {canInstall && (
          <button type="button" className="cl-install-btn" onClick={onInstall}>
            Install
          </button>
        )}
        <button
          type="button"
          className="cl-install-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
