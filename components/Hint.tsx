"use client";

/* Small explanatory popover attached to a control.

   Deliberately not a hover-only tooltip. Hover does not exist on touch, and a
   large share of this tool's traffic is players checking builds on a phone, so
   a hover-only hint would be invisible to exactly the people who most need it.
   This renders a persistent "?" affordance that opens on click and also on
   hover for mouse users, which means the hint is discoverable without already
   knowing the feature is there. */

import { useEffect, useId, useRef, useState } from "react";

export default function Hint({
  label,
  children,
  align = "right",
}: {
  /** Short description of what the hint explains, for screen readers. */
  label: string;
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-bright)] text-[10px] font-bold leading-none text-[var(--text-dim)] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={`absolute top-6 z-50 w-64 rounded-lg border border-[var(--border-bright)] bg-[var(--bg-2)] p-2.5 text-[11px] leading-relaxed text-[var(--text-muted)] shadow-xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
