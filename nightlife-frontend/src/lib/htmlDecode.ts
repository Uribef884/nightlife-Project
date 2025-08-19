// src/lib/htmlDecode.ts
// Isomorphic HTML entity decoder (works in SSR and CSR).
// Decodes named (&amp;, &lt;, &gt;, &quot;, &apos;, &nbsp;, &sol;, &frasl;)
// and numeric (&#47;, &#x2F;) entities. Semicolon is optional to be tolerant.
//
// Security note: This ONLY decodes entities; it does not sanitize URLs or HTML.
// Always use rel="noopener noreferrer" on external links.
//
// Example:
//  htmlDecode("https:&#x2F;&#x2F;instagram.com&#x2Flaperla") === "https://instagram.com/laperla"

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: "\"",
  apos: "'",
  nbsp: "\u00A0",
  sol: "/",
  frasl: "⁄",
};

export function htmlDecode(input?: string | null): string {
  if (!input) return "";
  return input.replace(/&(#x?[0-9A-Fa-f]+|\w+);?/g, (full, ent) => {
    // Numeric entity: &#... or &#x...
    if (ent[0] === "#") {
      const isHex = ent[1]?.toLowerCase() === "x";
      const numStr = isHex ? ent.slice(2) : ent.slice(1);
      const codePoint = parseInt(numStr, isHex ? 16 : 10);
      if (Number.isFinite(codePoint)) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return full;
        }
      }
      return full;
    }
    // Named entity
    const named = NAMED[ent];
    return named !== undefined ? named : full;
  });
}

/** Convenience for links: decode and trim; returns undefined if empty after decode */
export function decodeLink(input?: string | null): string | undefined {
  const out = htmlDecode(input).trim();
  return out.length ? out : undefined;
}
