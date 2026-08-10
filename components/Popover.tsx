"use client";

/* Popover that stays on screen.

   Both the score breakdown and the inline hints were positioned with plain
   `absolute` against their trigger, which cannot see the viewport: a trigger
   near an edge — or anywhere at all once the page is scrolled horizontally —
   pushed a fixed-width panel straight off the side, clipped and unreadable.

   This renders into a portal on document.body with fixed positioning measured
   from the trigger's bounding rect, then clamps to the viewport and flips above
   the trigger when there isn't room below. Portalling also means no ancestor's
   overflow or stacking context can clip it, which the card layouts are full of.

   Positioning is recomputed on scroll and resize while open, since a fixed
   panel would otherwise drift away from a trigger that moves. */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 8;

export default function Popover({
  open,
  onClose,
  anchorRef,
  width = 352,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  width?: number;
  children: React.ReactNode;
  label: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useEffect(() => setMounted(true), []);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const panelW = Math.min(width, vw - MARGIN * 2);
    const panelH = panelRef.current?.offsetHeight ?? 0;

    // Prefer right-aligned to the trigger, which keeps the panel visually
    // attached to the control rather than floating off to one side.
    let left = rect.right - panelW;
    if (left < MARGIN) left = MARGIN;
    if (left + panelW > vw - MARGIN) left = Math.max(MARGIN, vw - MARGIN - panelW);

    let top = rect.bottom + 6;
    // Flip above only when there is genuinely more room there, so a panel near
    // the bottom does not get pinned to the top of a tall screen for no reason.
    if (panelH && top + panelH > vh - MARGIN) {
      const above = rect.top - 6 - panelH;
      top = above >= MARGIN ? above : Math.max(MARGIN, vh - MARGIN - panelH);
    }
    setPos({ left, top });
  }, [anchorRef, width]);

  // Layout effect so the first paint is already in the right place — with a
  // plain effect the panel visibly jumps from the top-left corner.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    // Measure again once the panel has real height, so the flip decision is
    // made against its actual size rather than zero.
    const raf = requestAnimationFrame(place);
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);

    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, place, onClose, anchorRef]);

  if (!mounted || !open) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={{
        position: "fixed",
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        width: `min(${width}px, calc(100vw - ${MARGIN * 2}px))`,
        maxHeight: `calc(100vh - ${MARGIN * 2}px)`,
        // Hidden until measured, so it never flashes in the wrong place.
        visibility: pos ? "visible" : "hidden",
      }}
      className="z-[100] overflow-y-auto overscroll-contain rounded-lg border border-[var(--border-bright)] bg-[var(--bg-2)] p-3 text-left shadow-2xl"
    >
      {children}
    </div>,
    document.body
  );
}
