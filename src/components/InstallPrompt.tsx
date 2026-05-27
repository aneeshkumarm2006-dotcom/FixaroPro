"use client";

import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "cleano:install-dismissed";

/**
 * Shows a small floating card prompting the user to install the PWA.
 * - Chrome / Android: captures `beforeinstallprompt` and triggers the native prompt.
 * - iOS Safari: shows manual "Add to Home Screen" instructions (no native event there).
 * - Hidden once dismissed (localStorage) or when already installed (standalone display mode).
 * - Mobile only; hidden on desktop via CSS.
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosPrompt, setIosPrompt] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Already installed → nothing to do.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari (typed loosely)
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone) return;

    // Previously dismissed.
    if (localStorage.getItem(DISMISS_KEY)) return;

    setHidden(false);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari never fires beforeinstallprompt — detect and show our own card.
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const isInWebView = /CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIOS && !isInWebView) {
      const t = setTimeout(() => setIosPrompt(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferred(null);
    setIosPrompt(false);
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {
      /* user dismissed */
    }
    setDeferred(null);
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  if (hidden) return null;
  if (!deferred && !iosPrompt) return null;

  return (
    <div className="cl-install-prompt" role="dialog" aria-live="polite">
      <div className="cl-install-icon">
        {iosPrompt ? <Share size={18} /> : <Download size={18} />}
      </div>
      <div className="cl-install-body">
        <strong>Install Cleano</strong>
        <span>
          {iosPrompt
            ? "Tap Share, then Add to Home Screen."
            : "Add Cleano to your phone for the full app experience."}
        </span>
      </div>
      <div className="cl-install-actions">
        {deferred && (
          <button type="button" className="cl-install-btn" onClick={install}>
            Install
          </button>
        )}
        <button
          type="button"
          className="cl-install-dismiss"
          onClick={dismiss}
          aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
