"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type AdminModalProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function AdminModal({
  title,
  open,
  onClose,
  children,
  footer,
}: AdminModalProps) {
  const titleId = useId();
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCloseRef.current(); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex animate-fade-in items-end justify-center bg-neutral-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[92dvh] w-full max-w-lg animate-sheet-up flex-col overflow-hidden rounded-t-3xl border border-neutral-200 bg-white shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)] sm:max-h-[88vh] sm:animate-scale-in sm:rounded-3xl">
        <div className="flex justify-center pt-2.5 sm:hidden"><span className="h-1 w-10 rounded-full bg-neutral-200" /></div>
        <div className="flex items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 sm:px-6">
          <h2 id={titleId} className="text-base font-bold text-neutral-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer ? (
          <div className="safe-bottom border-t border-neutral-200 bg-white px-5 pt-4 sm:px-6 sm:pb-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
