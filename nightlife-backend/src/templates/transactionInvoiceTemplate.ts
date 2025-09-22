// src/templates/transactionInvoiceTemplate.ts
// Email de factura/recibo de la transacción completa.
// Se envía UNA SOLA VEZ por transacción, con el desglose completo.
// Requiere logo inline cid:nl-logo.png.

export type TransactionInvoiceParams = {
  to: string;
  transactionId: string;
  clubName: string;
  clubAddress?: string;
  clubPhone?: string;
  clubEmail?: string;
  date: string;
  items: Array<{
    name: string;
    variant?: string | null;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  subtotal: number;
  platformFees: number;
  gatewayFees: number;
  gatewayIVA: number;
  total: number;
  currency?: string;
  paymentMethod: string;
  paymentProviderRef?: string;
  customerInfo?: {
    fullName?: string;
    phoneNumber?: string;
    email?: string;
    legalId?: string;
    legalIdType?: string;
    creditCard?: string;
  };
};

export function generateTransactionInvoiceHTML(p: TransactionInvoiceParams): string {
  const currency = p.currency || "COP";
  
  const itemRows = p.items
    .map((item) => {
      const variantText = item.variant ? ` • ${escapeHtml(item.variant)}` : "";
      return `
        <tr>
          <td style="padding:12px 16px;border-bottom:1px solid #1E2530;color:#DDE3EE;font:14px Arial,Helvetica,sans-serif;">
            ${escapeHtml(item.name)}${variantText}
          </td>
          <td align="center" style="padding:12px 16px;border-bottom:1px solid #1E2530;color:#C7CFDC;font:14px Arial,Helvetica,sans-serif;">
            ${item.quantity}
          </td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #1E2530;color:#C7CFDC;font:14px Arial,Helvetica,sans-serif;">
            ${fmt(item.unitPrice, currency)}
          </td>
          <td align="right" style="padding:12px 16px;border-bottom:1px solid #1E2530;color:#FFFFFF;font:14px Arial,Helvetica,sans-serif;">
            ${fmt(item.subtotal, currency)}
          </td>
        </tr>`;
    })
    .join("");

  const customerInfoSection = p.customerInfo ? `
    <tr>
      <td style="padding:0 24px 16px 24px;">
        <div style="background:#0E141C;border-radius:12px;padding:16px;margin-bottom:16px;">
          <h3 style="margin:0 0 12px 0;font:600 16px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Información del Comprador</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div>
              ${p.customerInfo.fullName ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Nombre:</strong> ${escapeHtml(p.customerInfo.fullName)}</p>` : ''}
              ${p.customerInfo.phoneNumber ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Teléfono:</strong> ${escapeHtml(p.customerInfo.phoneNumber)}</p>` : ''}
              ${p.customerInfo.email ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Email:</strong> ${escapeHtml(p.customerInfo.email)}</p>` : ''}
            </div>
            <div>
              ${p.customerInfo.legalId ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>${p.customerInfo.legalIdType || 'ID'}:</strong> ${escapeHtml(p.customerInfo.legalId)}</p>` : ''}
              ${p.customerInfo.creditCard ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Tarjeta de Crédito:</strong> ${escapeHtml(p.customerInfo.creditCard)}</p>` : ''}
            </div>
          </div>
        </div>
      </td>
    </tr>` : '';

  return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Factura NightLife</title>
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

          <!-- Invoice Header -->
          <tr>
            <td style="padding:18px 24px 0 24px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;">
                <div>
                  <h1 style="margin:0 0 8px 0;font:700 24px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Factura para el Comprador</h1>
                  <p style="margin:6px 0 0 0;font:13px Arial,Helvetica,sans-serif;color:#AEB6C3;">Factura #: ${escapeHtml(p.transactionId)}</p>
                  <p style="margin:6px 0 0 0;font:13px Arial,Helvetica,sans-serif;color:#AEB6C3;">Fecha: ${escapeHtml(p.date)}</p>
                </div>
                <div style="text-align:right;">
                  <p style="margin:6px 0 0 0;font:13px Arial,Helvetica,sans-serif;color:#AEB6C3;">ID de Transacción: ${escapeHtml(p.transactionId)}</p>
                  ${p.paymentProviderRef ? `<p style="margin:6px 0 0 0;font:13px Arial,Helvetica,sans-serif;color:#AEB6C3;">Ref. de Pago: ${escapeHtml(p.paymentProviderRef)}</p>` : ''}
                </div>
              </div>
            </td>
          </tr>

          <!-- Club Information -->
          <tr>
            <td style="padding:0 24px 16px 24px;">
              <div style="background:#0E141C;border-radius:12px;padding:16px;margin-bottom:16px;">
                <h3 style="margin:0 0 12px 0;font:600 16px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Información del Club</h3>
                <p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Nombre:</strong> ${escapeHtml(p.clubName)}</p>
                ${p.clubAddress ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Dirección:</strong> ${escapeHtml(p.clubAddress)}</p>` : ''}
                ${p.clubPhone ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Teléfono:</strong> ${escapeHtml(p.clubPhone)}</p>` : ''}
                ${p.clubEmail ? `<p style="margin:6px 0 0 0;font:14px Arial,Helvetica,sans-serif;color:#C9D1E0;"><strong>Email:</strong> ${escapeHtml(p.clubEmail)}</p>` : ''}
              </div>
            </td>
          </tr>

          ${customerInfoSection}

          <!-- Items table -->
          <tr>
            <td style="padding:0 24px 16px 24px;">
              <h3 style="margin:0 0 12px 0;font:600 16px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Artículos Comprados</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#0E141C;border-radius:12px;overflow:hidden;">
                <thead>
                  <tr>
                    <th align="left"   style="padding:12px 16px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Artículo</th>
                    <th align="center" style="padding:12px 16px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Cant.</th>
                    <th align="right"  style="padding:12px 16px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Precio Unit.</th>
                    <th align="right"  style="padding:12px 16px;background:#111927;color:#AEB6C3;font:12px Arial,Helvetica,sans-serif;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRows}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Totals breakdown -->
          <tr>
            <td style="padding:0 24px 16px 24px;">
              <h3 style="margin:0 0 12px 0;font:600 16px/1.25 Arial,Helvetica,sans-serif;color:#F4F6FB;">Totales</h3>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0E141C;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:16px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:8px 0;color:#C9D1E0;font:14px Arial,Helvetica,sans-serif;">Subtotal:</td>
                        <td align="right" style="padding:8px 0;color:#C9D1E0;font:14px Arial,Helvetica,sans-serif;">${fmt(p.subtotal, currency)}</td>
                      </tr>
                      <tr>
                        <td style="padding:8px 0;color:#C9D1E0;font:14px Arial,Helvetica,sans-serif;">Cargo por servicio:</td>
                        <td align="right" style="padding:8px 0;color:#C9D1E0;font:14px Arial,Helvetica,sans-serif;">${fmt(p.platformFees + p.gatewayFees + p.gatewayIVA, currency)}</td>
                      </tr>
                      <tr style="border-top:1px solid #1E2530;">
                        <td style="padding:12px 0;color:#FFFFFF;font:600 16px Arial,Helvetica,sans-serif;">Total Pagado:</td>
                        <td align="right" style="padding:12px 0;color:#FFFFFF;font:600 16px Arial,Helvetica,sans-serif;">${fmt(p.total, currency)}</td>
                      </tr>
                    </table>
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

function fmt(n: number, currency: string): string {
  try {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency }).format(n);
  } catch {
    return `$ ${n.toLocaleString("es-CO")}`;
  }
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
