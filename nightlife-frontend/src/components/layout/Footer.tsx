// src/components/layout/Footer.tsx
"use client";
import Link from "next/link";

// ---- Configure your socials here (or via env vars) -------------------------
const WHATSAPP_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_URL
const INSTAGRAM_URL =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL
const TIKTOK_URL =
  process.env.NEXT_PUBLIC_TIKTOK_URL 
  
// ---- Minimal, crisp SVG icons that render on dark backgrounds --------------
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

// Lucide-style outline Instagram (clean on dark UIs)
function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="currentColor" />
    </svg>
  );
}

// SimpleIcons TikTok path (works with currentColor)
function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M12.9 3h2.77c.17 1.05.66 2.02 1.41 2.77A6.1 6.1 0 0020.9 7v2.78a8.86 8.86 0 01-4.77-1.44v6.39a6.73 6.73 0 11-6.73-6.73c.33 0 .65.03.96.08v2.83a3.9 3.9 0 00-.96-.12 3.9 3.9 0 103.9 3.9V3z"
      />
    </svg>
  );
}

// ----------------------------------------------------------------------------
export default function Footer() {
  const year = new Date().getFullYear();

  const socials = [
    { name: "WhatsApp", href: WHATSAPP_URL, Icon: WhatsAppIcon },
    { name: "Instagram", href: INSTAGRAM_URL, Icon: InstagramIcon },
    { name: "TikTok", href: TIKTOK_URL, Icon: TikTokIcon },
  ];

  const aboutLinks = [
    { label: "Sobre nosotros", href: "/about" },
    { label: "Únete al equipo", href: "/careers" },
  ];

  const legalLinks = [
    { label: "Términos y condiciones", href: "/terminos" },
    { label: "Política de Privacidad", href: "/privacidad" },
  ];

  return (
    <footer className="w-full border-t border-slate-800/60 bg-slate-900/80 backdrop-blur text-slate-300">
      <div className="mx-auto max-w-6xl px-4 py-4">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Acerca de */}
          <div>
            <h3 className="text-xl font-semibold text-slate-200">Acerca Nightlife</h3>
            <ul className="mt-3 space-y-2">
              {aboutLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="transition hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Redes */}
          <div>
            <h3 className="text-xl font-semibold text-slate-200">Nuestras redes</h3>
            <div className="mt-3 flex items-center gap-3">
              {socials.map(({ name, href, Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={name}
                  className="group inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700/50 bg-slate-800/30 transition hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                >
                  <Icon className="h-5 w-5 text-slate-200 group-hover:text-white" />
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="my-4 h-px w-full bg-slate-800/60" />

        {/* Bottom bar */}
        <div className="flex flex-col items-start justify-between gap-3 text-xs md:flex-row md:items-center">
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {legalLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="transition hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 rounded"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-slate-400">©{year} Nightlife — Todos los derechos reservados</p>
        </div>
      </div>
    </footer>
  );
}