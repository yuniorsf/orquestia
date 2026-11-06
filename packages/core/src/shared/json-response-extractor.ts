/**
 * Extracts the single JSON object an agent CLI was asked to respond with
 * "ONLY... no commentary" — tolerating a ```json fence, surrounding prose,
 * and (the case that actually broke this in practice) tool-call transcript
 * noise a headless CLI run with full tool access can print to the same
 * stdout stream *before* its final answer, which can itself contain
 * unrelated braces (shell output, --help text, file contents it read).
 *
 * Because that noise can carry its own '{'/'}' characters, "first '{' to
 * last '}'" is not reliable. Instead this tries every '{' at or before the
 * last '}', from closest-to-the-end outward, and accepts the first slice
 * that is actually valid JSON — reusing JSON.parse itself as the
 * validator instead of a hand-rolled string/escape-aware brace scanner.
 */
export function extractJsonObject(text: string): string {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(trimmed);
  const candidate = fenced ? (fenced[1] as string) : trimmed;

  const lastBrace = candidate.lastIndexOf('}');
  if (lastBrace === -1) {
    return candidate;
  }

  const openBraceIndices: number[] = [];
  for (let i = 0; i <= lastBrace; i += 1) {
    if (candidate[i] === '{') {
      openBraceIndices.push(i);
    }
  }
  if (openBraceIndices.length === 0) {
    return candidate.slice(0, lastBrace + 1);
  }

  for (let i = openBraceIndices.length - 1; i >= 0; i -= 1) {
    const slice = candidate.slice(openBraceIndices[i] as number, lastBrace + 1);
    try {
      JSON.parse(slice);
      return slice;
    } catch {
      // Not a balanced/valid JSON object from this '{' — try an earlier one.
    }
  }

  // Nothing parsed; fall back to the original first-to-last span so the
  // caller's own JSON.parse still raises a representative error.
  return candidate.slice(openBraceIndices[0] as number, lastBrace + 1);
}
