// src/components/domain/club/ClubSocials.tsx
"use client";

import { decodeLink } from "@/lib/htmlDecode";

/* ----------------------------------------------------------------------------
   Minimal, crisp SVG icons that render well on dark backgrounds.
   They inherit `currentColor`, so hover/focus will tint icon + text together.
---------------------------------------------------------------------------- */
function WhatsAppIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M20.52 3.48A11.985 11.985 0 0012 0C5.373 0 0 5.373 0 12c0 2.118.552 4.21 1.6 6.047L0 24l6.109-1.593A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12 0-3.196-1.245-6.198-3.48-8.52zM12 22a9.96 9.96 0 01-5.078-1.386l-.364-.215-3.605.94.962-3.516-.235-.374A10 10 0 1122 12c0 5.523-4.477 10-10 10zm5.472-7.618c-.297-.149-1.758-.867-2.03-.967-.273-.1-.472-.149-.67.149-.198.297-.767.966-.94 1.164-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.134.297-.347.446-.52.149-.173.198-.297.298-.495.099-.198.05-.372-.025-.521-.075-.149-.669-1.612-.916-2.206-.241-.579-.487-.5-.67-.51-.173-.009-.372-.011-.57-.011-.198 0-.52.074-.792.372-.273.297-1.043 1.02-1.043 2.486 0 1.466 1.068 2.88 1.217 3.078.149.198 2.104 3.213 5.1 4.506.714.308 1.27.492 1.703.63.715.227 1.365.195 1.881.118.574-.086 1.758-.718 2.007-1.412.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.569-.347z"
      />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

/* ----------------------------- URL hardening ------------------------------- */
/** http(s) only; strips everything else. */
function ensureHttpHttps(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    // Force https for known social hosts
    if (u.protocol === "http:") {
      u.protocol = "https:";
    }
    return u.toString();
  } catch {
    return null;
  }
}

/** Convert various WhatsApp forms into a safe https URL. */
function normalizeWhatsApp(input?: string | null): string | null {
  if (!input) return null;
  const raw = (decodeLink(input) ?? "").trim();
  if (!raw) return null;

  // 1) Bare phone numbers like "+57 300 123 4567" → https://wa.me/573001234567
  const numberish = /^[+()0-9.\-\s]{6,}$/.test(raw);
  if (numberish) {
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 6) {
      return `https://wa.me/${digits}`;
    }
  }

  // 2) App scheme: whatsapp://send?phone=...&text=...  OR intent://
  if (/^(whatsapp|intent):/i.test(raw)) {
    // Extract query string manually
    const q = raw.split("?")[1] || "";
    const params = new URLSearchParams(q);
    const phone = (params.get("phone") || params.get("phoneNumber") || "").replace(/\D/g, "");
    const text = params.get("text") || "";
    const base = "https://api.whatsapp.com/send";
    const u = new URL(base);
    if (phone) u.searchParams.set("phone", phone);
    if (text) u.searchParams.set("text", text);
    return u.toString();
  }

  // 3) URL-like; add https:// if missing
  const withProto = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }

  // Allow-list of WhatsApp hosts (incl. subdomains) and short links
  const host = u.hostname.toLowerCase();
  const allowRoots = [
    "whatsapp.com",   // api.whatsapp.com, web.whatsapp.com, chat.whatsapp.com, etc.
    "wa.me",
    "wa.link",
  ];
  const allowed = allowRoots.some((root) => host === root || host.endsWith(`.${root}`));
  if (!allowed) return null;

  // Force https and return
  u.protocol = "https:";
  return ensureHttpHttps(u.toString());
}

/** Instagram: keep http(s) only and restrict to instagram.com + subdomains. */
function normalizeInstagram(input?: string | null): string | null {
  if (!input) return null;
  const raw = (decodeLink(input) ?? "").trim();
  if (!raw) return null;

  const withProto = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw}`;
  let u: URL;
  try {
    u = new URL(withProto);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const allowed = host === "instagram.com" || host.endsWith(".instagram.com");
  if (!allowed) return null;

  u.protocol = "https:";
  return ensureHttpHttps(u.toString());
}

/* ------------------------------- Component -------------------------------- */
export function ClubSocials({
  instagram,
  whatsapp,
}: {
  instagram?: string | null;
  whatsapp?: string | null;
}) {
  const igHref = normalizeInstagram(instagram);
  const waHref = normalizeWhatsApp(whatsapp);

  if (!igHref && !waHref) return null;

  const baseBtn =
    "inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 " +
    "text-white/90 hover:bg-white/10 focus:outline-none focus-visible:ring-2 " +
    "focus-visible:ring-nl-secondary/50 transition";
  const iconCls = "h-5 w-5 shrink-0";

  return (
    <div className="flex items-center gap-3">
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          className={baseBtn}
          aria-label="Abrir WhatsApp"
        >
          <WhatsAppIcon className={iconCls} />
          <span>WhatsApp</span>
        </a>
      )}
      {igHref && (
        <a
          href={igHref}
          target="_blank"
          rel="noopener noreferrer"
          className={baseBtn}
          aria-label="Abrir Instagram"
        >
          <InstagramIcon className={iconCls} />
          <span>Instagram</span>
        </a>
      )}
    </div>
  );
}
