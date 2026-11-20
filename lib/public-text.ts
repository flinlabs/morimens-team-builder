/** Guard for annotation prose that reaches the public site.

The annotation layer doubles as a working notebook: it records who made a call
("Felix's call", "per Lyra"), which guide a figure came from, and pointers into
annotations/LYRA-NOTES.md. That provenance belongs in the repo, not in the
character modal. Notes are meant to be written player-facing in the first place
(tests/public-text.test.ts fails the build when one is not), so this is the
second line of defence: any sentence or parenthetical that still names an
internal source is dropped before the text leaves the API. */

const INTERNAL_SOURCE =
  /\b(?:felix(?:'s)?|lyra(?:'s)?|lyra-notes|zekiel|cheri|kaly|skeydb|mythag compendium|mythag\.net|compendium|annotations?|adjudicat\w*|flagged in|hand-authored|transcribed|experimental log|new player handbook)\b/i

/** Sentence-ish chunks, keeping their trailing punctuation and whitespace. */
const SENTENCE = /[^.!?]+(?:[.!?]+["')\]]*|$)\s*/g

export function publicNote(text: string | null | undefined): string | null {
  if (!text) return null
  const kept = text
    .split(/\n{2,}/)
    .map((para) =>
      (para.match(SENTENCE) ?? [para])
        .map((s) => s.replace(/\s*\([^()]*\)/g, (p) => (INTERNAL_SOURCE.test(p) ? '' : p)))
        .filter((s) => !INTERNAL_SOURCE.test(s))
        .join('')
        .trim()
    )
    .filter(Boolean)
    .join('\n\n')
  return kept || null
}

/** True when a string still carries an internal-source reference. */
export function hasInternalSource(text: string | null | undefined): boolean {
  return !!text && INTERNAL_SOURCE.test(text)
}
