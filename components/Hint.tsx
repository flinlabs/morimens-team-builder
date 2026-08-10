"use client";

/* Small explanatory popover attached to a control.

   Deliberately not a hover-only tooltip. Hover does not exist on touch, and a
   large share of this tool's traffic is players checking builds on a phone, so
   a hover-only hint would be invisible to exactly the people who most need it.
   This renders a persistent "?" affordance that opens on click and also on
   hover for mouse users, which means the hint is discoverable without already
   knowing the feature is there.

   Positioning is delegated to Popover, which portals to the body and clamps to
   the viewport — an `absolute` panel anchored to a control near a screen edge
   ends up half off-screen, which is what these used to do. */

import { useRef, useState } from "react";
import Popover from "./Popover";

export default function Hint({
  label,
  children,
}: {
  /** Short description of what the hint explains, for screen readers. */
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A small grace period on mouse-out, so moving the pointer from the trigger
  // into the panel to read or select text does not dismiss it.
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 180);
  };

  return (
    <span
      ref={anchorRef}
      className="inline-flex"
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          cancelClose();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-bright)] text-[10px] font-bold leading-none text-[var(--text-dim)] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
      >
        ?
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={anchorRef}
        width={288}
        label={label}
      >
        <div
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          className="text-[11px] leading-relaxed text-[var(--text-muted)]"
        >
          {children}
        </div>
      </Popover>
    </span>
  );
}
