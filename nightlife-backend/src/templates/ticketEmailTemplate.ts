// src/templates/ticketEmailTemplate.ts
// Un (1) email por ticket del carrito. Un (1) QR por ticket.
// Requiere que el logo se envíe inline como cid:nl-logo.png

export type TicketEmailParams = {
  email: string;           // destinatario (no se muestra, solo para trazas si lo usas)
  to?: string;             // compatibilidad
  ticketName: string;
  date: string;            // ISO o legible; se imprime tal cual
  qrImageDataUrl: string;  // data:image/png;base64,...
  clubName: string;
  description?: string | null;
  index?: number;          // 1-based, opcional
  total?: number;          // total de tickets en el carrito, opcional
  purchaseId?: string;     // opcional, si quieres mostrar ID
};

export function generateTicketEmailHTML(p: TicketEmailParams): string {
  // Always show numbering when there are multiple tickets, make it more prominent
  const ticketNumbering = p.index && p.total ? ` - Boleto ${p.index} de ${p.total}` : "";
  
  const purchaseLine =
    p.purchaseId ? `Tu reserva: <strong>${p.purchaseId}</strong>${ticketNumbering}` : `Tu reserva${ticketNumbering}`;

  const desc =
    p.description && p.description.trim().length > 0
      ? `<li style="margin:6px 0;">Descripción: ${escapeHtml(p.description)}</li>`
      : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Ticket NightLife</title>
</head>
<body style="margin:0;padding:0;background:#10091a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#6B3FA0 0%,#2B1B4E 100%);">
    <tr>
      <td align="center" style="padding:28px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#0F1216;border-radius:24px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.35);">

          <!-- Header -->
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

          <!-- Card title & bullets -->
          <tr>
            <td style="padding:18px 24px 0 24px;">
              <h1 style="margin:0 0 8px 0;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">${purchaseLine}</h1>
              <ul style="margin:14px 0 0 18px;padding:0;color:#C9D1E0;font:14px/1.65 Arial,Helvetica,sans-serif;">
                <li style="margin:6px 0;">Club: ${escapeHtml(p.clubName)}</li>
                <li style="margin:6px 0;">${escapeHtml(p.ticketName)}</li>
                <li style="margin:6px 0;">Fecha: ${escapeHtml(p.date)}</li>
                ${desc}
              </ul>
            </td>
          </tr>

          <!-- QR -->
          <tr>
            <td align="center" style="padding:24px 24px 8px 24px;">
              <p style="margin:0 0 12px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">Presenta este código en la entrada:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.35);">
                <tr>
                  <td style="padding:18px;">
                    <img src="${p.qrImageDataUrl}" width="320" alt="QR Ticket" style="display:block;border-radius:12px;">
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Legal -->
          ${legalSection()}

          <!-- Footer -->
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
        Recuerda tener en cuenta reglas del club, fecha y hora de tu reserva. Si tienes alguna inquietud con esta transacción, por favor comunícate a través del chat en nuestro sitio o WhatsApp.
      </p>
      <ul style="margin:8px 0 0 18px;color:#98A4B5;font:12px/1.6 Arial,Helvetica,sans-serif;">
        <li>Una vez finalizada la transacción y sin perjuicio del derecho de retracto según la ley aplicable, NightLife no realiza devoluciones de dinero ni cambios de fechas u horarios pasadas las condiciones del evento.</li>
        <li>Para más información legal y PQRs visita nuestro sitio web.</li>
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
