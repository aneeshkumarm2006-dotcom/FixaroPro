"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  width?: number;
}

export default function CustomerModal({
  open,
  onClose,
  title,
  description,
  children,
  width = 460,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="cl-modal-backdrop" onClick={onClose}>
      <div
        className="cl-modal"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}>
        <header className="cl-modal-head">
          <div>
            <h2 className="cl-modal-title">{title}</h2>
            {description ? (
              <p className="cl-modal-desc">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            className="cl-icon-btn"
            aria-label="Close"
            onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="cl-modal-body">{children}</div>
      </div>
    </div>
  );
}
