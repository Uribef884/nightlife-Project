// src/components/domain/club/ClubSocials.tsx
"use client";

import { decodeLink } from "@/lib/htmlDecode";

/**
 * Renders club socials (conditionally) with decoded links.
 * We decode on BOTH server and client so hydration matches exactly.
 */
export function ClubSocials({
  instagram,
  whatsapp,
}: {
  instagram?: string | null;
  whatsapp?: string | null;
}) {
  const ig = decodeLink(instagram);
  const wa = decodeLink(whatsapp);

  // Normalize to absolute URLs if someone saved without protocol
  const normalize = (url: string) =>
    /^https?:\/\//i.test(url) ? url : `https://${url}`;

  if (!ig && !wa) return null;

  return (
    <div className="flex items-center gap-3">
      {wa && (
        <a
          href={normalize(wa)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-3 py-2 text-white/90 hover:bg-white/10"
        >
          WhatsApp
        </a>
      )}
      {ig && (
        <a
          href={normalize(ig)}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-white/15 px-3 py-2 text-white/90 hover:bg-white/10"
        >
          Instagram
        </a>
      )}
    </div>
  );
}
