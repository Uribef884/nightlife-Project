// src/templates/menuFromTicketEmailTemplate.ts
// Email de “menú incluido con el ticket”.
// Se envía EN ADICIÓN al email de ticket (tal como haces).
// Un (1) QR para este menú incluido. Requiere logo cid:nl-logo.png.

export type MenuFromTicketParams = {
  to: string;
  email: string; // compatibilidad con tu caller actual
  ticketName: string;
  date: string;
  qrImageDataUrl: string;
  clubName: string;
  items: Array<{ name: string; variant: string | null; quantity: number }>;
  index?: number;          // 1-based, opcional - for numbering when multiple tickets
  total?: number;          // total de tickets en el carrito, opcional
};

export function generateMenuFromTicketEmailHTML(p: MenuFromTicketParams): string {
  // Add prominent numbering when there are multiple tickets
  const ticketNumbering = p.index && p.total ? ` - Ticket ${p.index} de ${p.total}` : "";
  
  const items = p.items
    .map((it) => {
      const v = it.variant ? ` • ${escapeHtml(it.variant)}` : "";
      return `<li style="margin:6px 0;">${escapeHtml(it.name)}${v} × ${it.quantity}</li>`;
    })
    .join("");

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Menú incluido</title>
</head>
<body style="margin:0;padding:0;background:#10091a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#6B3FA0 0%,#2B1B4E 100%);">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0F1216;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.35);">

          <!-- Header -->
          <tr>
            <td style="padding:20px 24px;background:#0B0E12;">
              <img src="cid:nl-logo.png" width="140" alt="NightLife" style="display:block;border:0;outline:0;">
            </td>
          </tr>

          <!-- Context -->
          <tr>
            <td style="padding:18px 24px 0 24px;">
              <h1 style="margin:0 0 8px 0;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Menú incluido con tu ticket${ticketNumbering}</h1>
              <ul style="margin:10px 0 0 18px;padding:0;color:#C9D1E0;font:14px/1.65 Arial,Helvetica,sans-serif;">
                <li style="margin:6px 0;">Club: ${escapeHtml(p.clubName)}</li>
                <li style="margin:6px 0;">Ticket: ${escapeHtml(p.ticketName)}</li>
                <li style="margin:6px 0;">Fecha: ${escapeHtml(p.date)}</li>
              </ul>
            </td>
          </tr>

          <!-- Items incluidos -->
          <tr>
            <td style="padding:12px 24px 0 24px;">
              <p style="margin:0 0 8px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">Estos ítems están incluidos con tu ticket:</p>
              <ul style="margin:0 0 8px 18px;color:#DDE3EE;font:14px/1.6 Arial,Helvetica,sans-serif;">
                ${items}
              </ul>
            </td>
          </tr>

          <!-- QR -->
          <tr>
            <td align="center" style="padding:16px 24px 8px 24px;">
              <p style="margin:0 0 12px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">Muestra este código en la mesa o barra:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.35);">
                <tr>
                  <td style="padding:18px;">
                    <img src="${p.qrImageDataUrl}" width="320" alt="QR Menú incluido" style="display:block;border-radius:12px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${legalSection()}
          ${footerSection()}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]!));
}
function legalSection(): string {
  return `
  <tr>
    <td style="padding:8px 24px 20px 24px;">
      <p style="margin:18px 0 10px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">
        El canje de este menú se realiza el mismo día y en el establecimiento indicado. Sujeto a políticas del club.
      </p>
      <ul style="margin:8px 0 0 18px;color:#98A4B5;font:12px/1.6 Arial,Helvetica,sans-serif;">
        <li>Conserva este correo y presenta el código al personal autorizado.</li>
      </ul>
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
