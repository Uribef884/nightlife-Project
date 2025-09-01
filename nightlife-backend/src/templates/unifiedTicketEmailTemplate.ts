// src/templates/unifiedTicketEmailTemplate.ts
// Email unificado para tickets con menú incluido.
// Un (1) email con dos (2) QR codes: uno para el ticket (acceso)
// y otro para los ítems de menú incluidos (consumo).
// Requiere imagen embebida por CID: nl-logo.png

export type UnifiedTicketEmailParams = {
  to: string;
  email: string; // compat con tu caller actual
  ticketName: string;
  date: string; // fecha legible ya formateada
  ticketQrImageDataUrl: string;
  menuQrImageDataUrl: string;
  clubName: string;
  menuItems: Array<{ name: string; variant: string | null; quantity: number }>;
  index?: number; // 1-based (ej: 2 de 4)
  total?: number;
  description?: string | null;
};

export function generateUnifiedTicketEmailHTML(p: UnifiedTicketEmailParams): string {
  // --- Visual consistency with ticketEmailTemplate.ts ---
  // Title color, body color, caption color mirror existing template.
  const titleColor = "#F4F6FB";
  const bodyColor = "#C9D1E0";
  const captionColor = "#A5B0C2";
  const smallColor = "#98A4B5";

  // Numbering like the single-ticket template
  const numbering =
    typeof p.index === "number" && typeof p.total === "number" && p.total > 0
      ? ` - Boleto ${p.index} de ${p.total}`
      : "";

  // “Tu reserva” title (no purchaseId in this unified template)
  const titleLine = `Tu reserva${numbering}`;

  // Optional description (escaped)
  const desc =
    p.description && p.description.trim().length > 0
      ? `<li style="margin:6px 0;">Descripción: ${escapeHtml(p.description)}</li>`
      : "";

  // Included menu items (always shown if provided)
  const includeMenuBlock =
    Array.isArray(p.menuItems) && p.menuItems.length > 0
      ? `
      <tr>
        <td style="padding:12px 24px 0 24px;">
          <p style="margin:0 0 8px 0;font:600 14px Arial,Helvetica,sans-serif;color:${titleColor};">
            Ítems incluidos con tu ticket
          </p>
          <ul style="margin:0 0 8px 18px;color:${bodyColor};font:14px/1.6 Arial,Helvetica,sans-serif;padding:0;">
            ${p.menuItems
              .map((it) => {
                const variant = it.variant ? ` • ${escapeHtml(it.variant)}` : "";
                return `<li style="margin:6px 0;">${escapeHtml(it.name)}${variant} × ${safeInt(it.quantity, 0)}</li>`;
              })
              .join("")}
          </ul>
        </td>
      </tr>
    `
      : "";

  // Divider to strongly separate sections (same feel as the single template)
  const divider = `
    <tr>
      <td style="padding:10px 24px 2px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="height:1px;background:linear-gradient(90deg,rgba(255,255,255,0.06),rgba(255,255,255,0.2),rgba(255,255,255,0.06));border-radius:1px;"></td>
          </tr>
        </table>
      </td>
    </tr>`;

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Ticket + Menú incluido - NightLife</title>
</head>
<body style="margin:0;padding:0;background:#10091a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#6B3FA0 0%,#2B1B4E 100%);">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0F1216;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.35);">

          <!-- Header (identical style to ticketEmailTemplate) -->
          <tr>
            <td style="padding:20px 24px;background:#0B0E12;">
              <table role="presentation" width="100%">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="cid:nl-logo.png" width="140" alt="NightLife" style="display:block;border:0;outline:0;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Title & bullets (exact typography/colors as ticketEmailTemplate) -->
          <tr>
            <td style="padding:18px 24px 0 24px;">
              <h1 style="margin:0 0 8px 0;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:${titleColor};">
                ${titleLine}
              </h1>
              <ul style="margin:14px 0 0 18px;padding:0;color:${bodyColor};font:14px/1.65 Arial,Helvetica,sans-serif;">
                <li style="margin:6px 0;">Club: ${escapeHtml(p.clubName)}</li>
                <li style="margin:6px 0;">${escapeHtml(p.ticketName)}</li>
                <li style="margin:6px 0;">Fecha: ${escapeHtml(p.date)}</li>
                ${desc}
              </ul>
            </td>
          </tr>

          ${includeMenuBlock}

          <!-- Section: Acceso / Ticket (styled like captions in the ticket template) -->
          ${divider}
          <tr>
            <td style="padding:14px 24px 0 24px;">
              <p style="margin:0 0 6px 0;font:700 13px Arial,Helvetica,sans-serif;color:${captionColor};letter-spacing:.3px;text-transform:uppercase;">
                Acceso / Ticket
              </p>
              <p style="margin:0 0 12px 0;font:14px Arial,Helvetica,sans-serif;color:${bodyColor};">
                Presenta este código en la entrada:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 24px 8px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.35);">
                <tr>
                  <td style="padding:18px;">
                    <img src="${safeUrl(p.ticketQrImageDataUrl)}" width="320" alt="QR Ticket" style="display:block;border-radius:12px;max-width:320px;height:auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Section: Menú incluido -->
          ${divider}
          <tr>
            <td style="padding:14px 24px 0 24px;">
              <p style="margin:0 0 6px 0;font:700 13px Arial,Helvetica,sans-serif;color:${captionColor};letter-spacing:.3px;text-transform:uppercase;">
                Menú incluido
              </p>
              <p style="margin:0 0 12px 0;font:14px Arial,Helvetica,sans-serif;color:${bodyColor};">
                Muestra este código en la mesa o barra para canjear tus ítems incluidos:
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:4px 24px 8px 24px;">
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.35);">
                <tr>
                  <td style="padding:18px;">
                    <img src="${safeUrl(p.menuQrImageDataUrl)}" width="320" alt="QR Menú incluido" style="display:block;border-radius:12px;max-width:320px;height:auto;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal (copied tone from ticketEmailTemplate) -->
          ${legalSection(bodyColor, smallColor)}

          <!-- Footer (identical) -->
          ${footerSection()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ----------------- Helpers -----------------

function safeInt(n: any, def = 0): number {
  const v = Number(n);
  return Number.isFinite(v) ? Math.trunc(v) : def;
}

function safeUrl(u: string): string {
  return typeof u === "string" && u.length > 0 ? u : "";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]!));
}

// Match copy/tone/colors of the single-ticket legal block, but mention both QRs
function legalSection(bodyColor = "#C9D1E0", smallColor = "#98A4B5"): string {
  return `
  <tr>
    <td style="padding:8px 24px 20px 24px;">
      <p style="margin:18px 0 10px 0;font:14px Arial,Helvetica,sans-serif;color:${bodyColor};">
        Recuerda tener en cuenta reglas del club, fecha y hora de tu reserva. Si tienes alguna inquietud con esta transacción, por favor comunícate a través del chat en nuestro sitio o WhatsApp.
      </p>
      <ul style="margin:8px 0 0 18px;color:${smallColor};font:12px/1.6 Arial,Helvetica,sans-serif;">
        <li>Presenta el código de <strong>Acceso/Ticket</strong> en la entrada del evento.</li>
        <li>Presenta el código de <strong>Menú incluido</strong> en mesa o barra para canjear tus ítems.</li>
        <li>Una vez finalizada la transacción y sin perjuicio del derecho de retracto según la ley aplicable, NightLife no realiza devoluciones de dinero ni cambios de fechas u horarios pasadas las condiciones del evento.</li>
        <li>Para más información legal y PQRs visita nuestro sitio web.</li>
      </ul>
      
      <!-- Soporte y Enlaces -->
      <div style="margin:24px 0 16px 0;padding:16px;background:#1A1F2A;border-radius:12px;">
        <h3 style="margin:0 0 12px 0;font:600 16px Arial,Helvetica,sans-serif;color:#F4F6FB;">Soporte y Enlaces</h3>
        
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;font:600 14px Arial,Helvetica,sans-serif;color:#DDE3EE;">Soporte</h4>
          <ul style="margin:0 0 0 18px;color:${bodyColor};font:13px/1.5 Arial,Helvetica,sans-serif;">
            <li>Chat del sitio web</li>
            <li>WhatsApp: +57 XXX XXX XXXX</li>
            <li>Email: support@nightlife.com</li>
          </ul>
        </div>
        
                 <div style="margin-bottom:16px;">
           <h4 style="margin:0 0 8px 0;font:600 14px Arial,Helvetica,sans-serif;color:#DDE3EE;">Enlaces Importantes</h4>
           <ul style="margin:0 0 0 18px;color:${bodyColor};font:13px/1.5 Arial,Helvetica,sans-serif;">
             <li><a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/terms" style="color:#6B3FA0;text-decoration:none;">Términos y Servicio</a></li>
             <li><a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/privacy" style="color:#6B3FA0;text-decoration:none;">Política de Privacidad</a></li>
           </ul>
         </div>
        
        <p style="margin:0;font:12px/1.4 Arial,Helvetica,sans-serif;color:${smallColor};">
          Legal: Esta es tu factura oficial de NightLife. Consérvala para tus registros contables y en caso de cualquier consulta sobre tu compra. Los tickets y menús se envían por separado con sus respectivos códigos QR. NightLife Inc. - NIT: [Tu NIT aquí]
        </p>
      </div>
    </td>
  </tr>`;
}

function footerSection(): string {
  return `
  <tr>
    <td align="center" style="padding:16px 24px 24px 24px;background:#0B0E12;">
      <p style="margin:0;font:11px Arial,Helvetica,sans-serif;color:#7F8A9C;">© 2025 NightLife Inc. • Todos los derechos reservados</p>
    </td>
  </tr>`;
}
