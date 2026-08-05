"use client";

/* First-visit quick start.

   Three features were going unnoticed: pinning, that the inventory has to be
   entered by hand, and the in-game lineup codes. A tooltip cannot fix that —
   a tooltip only fires once you hover the control, which requires already
   knowing the control matters. So this shows itself once, unprompted, and then
   stays reachable from a "Quick guide" link rather than disappearing forever.

   The dismissal flag lives in its own localStorage key rather than in the
   roster store, so exporting an inventory never carries UI state with it and
   importing someone else's file never re-triggers or suppresses the guide. */

import { useEffect, useState } from "react";

const SEEN_KEY = "mtb.quickstart.seen.v1";

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: "Tell it what you own",
    body: (
      <>
        This tool can&apos;t read your Morimens account — nothing can, there&apos;s no public
        API — so the Inventory tab starts empty and you tick off what you have. It&apos;s the
        one slow part, and you only do it once: everything saves in this browser
        automatically. Use <strong>Export inventory</strong> to back it up or move it to
        another device.
      </>
    ),
  },
  {
    title: "Pin the characters you want to keep",
    body: (
      <>
        Place a character in a slot by hand and they become <strong>pinned</strong> — the
        pin badge appears in the corner. Generate then builds the rest of the team around
        them instead of replacing them. Click the badge to unpin, or use it to lock in a
        result you like before regenerating.
      </>
    ),
  },
  {
    title: "Move lineups in and out of the game",
    body: (
      <>
        <strong>Export to Morimens</strong> turns the team on screen into a{" "}
        <span className="font-mono">@@…@@</span> code you can paste into the game&apos;s
        Lineup screen. <strong>Import code</strong> does the reverse — paste a code from
        the game or from a friend and the board fills in, gear and posse included.
      </>
    ),
  },
];

export default function QuickStart() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      // Private browsing or storage disabled — skip the guide rather than
      // showing it on every render.
    }
  }, []);

  const close = () => {
    setOpen(false);
    setStep(0);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* nothing to do */
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => {
          setStep(0);
          setOpen(true);
        }}
        className="text-[11px] uppercase tracking-wider text-[var(--text-dim)] underline decoration-dotted underline-offset-4 transition hover:text-[var(--gold-bright)]"
      >
        Quick guide
      </button>
    );
  }

  const current = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick guide"
        className="fixed left-1/2 top-1/2 z-[61] w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[var(--border-bright)] bg-[var(--panel)] p-5 shadow-2xl"
      >
        <div className="mb-1 flex items-center gap-2">
          <span className="font-title text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
            {step + 1} of {STEPS.length}
          </span>
          <button
            onClick={close}
            className="ml-auto text-xs text-[var(--text-dim)] transition hover:text-[var(--text)]"
          >
            Skip
          </button>
        </div>

        <h2 className="font-title mb-2 text-base text-[var(--gold-bright)]">{current.title}</h2>
        <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">{current.body}</p>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${
                  i === step ? "bg-[var(--gold)]" : "bg-[var(--border-bright)]"
                }`}
              />
            ))}
          </div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="ml-auto rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-muted)] transition hover:border-[var(--border-bright)]"
            >
              Back
            </button>
          )}
          <button
            onClick={() => (last ? close() : setStep((s) => s + 1))}
            className={`rounded-md border border-[var(--gold)] bg-[var(--gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--gold-bright)] transition hover:bg-[var(--gold)]/20 ${
              step > 0 ? "" : "ml-auto"
            }`}
          >
            {last ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>
  );
}
