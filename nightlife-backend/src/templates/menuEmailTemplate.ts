// src/templates/menuEmailTemplate.ts
// Un (1) email por transacción de menú. Un (1) QR por transacción.
// Incluye un resumen de ítems antes del bloque legal.
// Requiere logo inline cid:nl-logo.png.

export type MenuItemRow = {
  name: string;
  variant: string | null;
  quantity: number;
  // unitPrice removed - no longer needed
};

export type MenuEmailParams = {
  to: string;
  clubName: string;
  items: MenuItemRow[];
  qrImageDataUrl: string;
  purchaseId?: string; // si deseas mostrarlo
  // total and currency removed - no longer needed
};

export function generateMenuEmailHTML(p: MenuEmailParams): string {
  const rows = p.items
    .map((it) => {
      const subtitle = it.variant ? ` • ${escapeHtml(it.variant)}` : "";
      return `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #1E2530;color:#DDE3EE;font:14px Arial,Helvetica,sans-serif;">
            ${escapeHtml(it.name)}${subtitle}
          </td>
          <td align="center" style="padding:10px 12px;border-bottom:1px solid #1E2530;color:#C7CFDC;font:14px Arial,Helvetica,sans-serif;">
            ${it.quantity}
          </td>
        </tr>`;
    })
    .join("");

  const idLine = p.purchaseId ? `<p style="margin:8px 0 0; font-size:12px; color:#AEB6C3;">Transacción: ${escapeHtml(p.purchaseId)}</p>` : "";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Menú NightLife</title>
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

          <!-- Title -->
          <tr>
            <td style="padding:18px 24px 0 24px;">
              <h1 style="margin:0 0 8px 0;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Tu orden de consumo</h1>
              <p style="margin:6px 0 0 0;font:13px Arial,Helvetica,sans-serif;color:#AEB6C3;">Club: ${escapeHtml(p.clubName)}</p>
              ${idLine}
            </td>
          </tr>

          <!-- Items table -->
          <tr>
            <td style="padding:16px 24px 8px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0E141C;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr>
                    <th align="left"   style="padding:10px 12px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Ítem</th>
                    <th align="center" style="padding:10px 12px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Cantidad</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
                <!-- Total row removed since prices are no longer shown -->
              </table>
            </td>
          </tr>

          <!-- QR -->
          <tr>
            <td align="center" style="padding:20px 24px 8px 24px;">
              <p style="margin:0 0 12px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">Presenta este código en la mesa o barra:</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="background:#FFFFFF;border-radius:18px;box-shadow:0 10px 24px rgba(0,0,0,.35);">
                <tr>
                  <td style="padding:18px;">
                    <img src="${p.qrImageDataUrl}" width="320" alt="QR Menú" style="display:block;border-radius:12px;">
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

// fmt function removed - no longer needed since prices are not shown
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m]!));
}
// Reutilizamos las mismas secciones que en el template de tickets:
function legalSection(): string {
  return `
  <tr>
    <td style="padding:8px 24px 20px 24px;">
      <p style="margin:18px 0 10px 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;">
        Si tienes dudas sobre tu pedido, contáctanos por el chat de nuestro sitio o por WhatsApp. Conserva este correo hasta recibir tus productos.
      </p>
      <ul style="margin:8px 0 0 18px;color:#98A4B5;font:12px/1.6 Arial,Helvetica,sans-serif;">
        <li>Compras de bar se redimen el mismo día/servicio indicado por el club. Aplica política del establecimiento.</li>
      </ul>
      
      <!-- Soporte y Enlaces -->
      <div style="margin:24px 0 16px 0;padding:16px;background:#1A1F2A;border-radius:12px;">
        <h3 style="margin:0 0 12px 0;font:600 16px Arial,Helvetica,sans-serif;color:#F4F6FB;">Soporte y Enlaces</h3>
        
        <div style="margin-bottom:16px;">
          <h4 style="margin:0 0 8px 0;font:600 14px Arial,Helvetica,sans-serif;color:#DDE3EE;">Soporte</h4>
          <ul style="margin:0 0 0 18px;color:#C9D1E0;font:13px/1.5 Arial,Helvetica,sans-serif;">
            <li>Chat del sitio web</li>
            <li>WhatsApp: +57 XXX XXX XXXX</li>
            <li>Email: support@nightlife.com</li>
          </ul>
        </div>
        
                 <div style="margin-bottom:16px;">
           <h4 style="margin:0 0 8px 0;font:600 14px Arial,Helvetica,sans-serif;color:#DDE3EE;">Enlaces Importantes</h4>
           <ul style="margin:0 0 0 18px;color:#C9D1E0;font:13px/1.5 Arial,Helvetica,sans-serif;">
             <li><a href="${process.env.FRONTEND_BASE_URL}/terms" style="color:#6B3FA0;text-decoration:none;">Términos y Servicio</a></li>
             <li><a href="${process.env.FRONTEND_BASE_URL}/privacy" style="color:#6B3FA0;text-decoration:none;">Política de Privacidad</a></li>
           </ul>
         </div>
        
        <p style="margin:0;font:12px/1.4 Arial,Helvetica,sans-serif;color:#98A4B5;">
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
