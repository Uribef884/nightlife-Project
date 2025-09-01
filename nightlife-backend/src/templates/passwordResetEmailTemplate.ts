// src/templates/passwordResetEmailTemplate.ts
// Plantilla en español para restablecimiento de contraseña.
// Usa logo inline CID: "nl-logo.png".
// Botón y acentos en morado NightLife (#6B3FA0).

export function generatePasswordResetEmailHTML({
  resetUrl,
}: {
  resetUrl: string;
}): string {
  return `
  <!DOCTYPE html>
  <html lang="es">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Restablecer contraseña</title>
    </head>
    <body style="margin:0; padding:0; background:#0b0b10;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0b10;">
        <tr>
          <td align="center" style="padding:24px 12px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px; background:#111317; border-radius:14px; overflow:hidden;">
              
              <!-- Header con logo -->
              <tr>
                <td style="padding:24px; background:#0f1216;">
                  <!-- IMPORTANTE: el filename del inline debe ser EXACTAMENTE "nl-logo.png" -->
                  <img src="cid:nl-logo.png" width="140" alt="NightLife" style="display:block; border:0; outline:0;"/>
                </td>
              </tr>

              <!-- Título -->
              <tr>
                <td style="padding:0 24px;">
                  <h1 style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:26px; color:#dce1ff;">
                    Cambia tu contraseña
                  </h1>
                </td>
              </tr>

              <!-- Copy -->
              <tr>
                <td style="padding:16px 24px 0 24px;">
                  <p style="margin:0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#b5bdd1;">
                    Hola,
                  </p>
                  <p style="margin:8px 0 0 0; font-family:Arial,Helvetica,sans-serif; font-size:15px; color:#b5bdd1;">
                    Hemos recibido una solicitud para restablecer la contraseña de tu cuenta NightLife. Haz clic en el botón de abajo para crear una nueva contraseña:
                  </p>
                </td>
              </tr>

              <!-- Botón morado (bulletproof) -->
              <tr>
                <td align="center" style="padding:24px;">
                  <table role="presentation" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td bgcolor="#6B3FA0" style="border-radius:999px; background:#6B3FA0;">
                        <a href="${resetUrl}"
                           style="display:inline-block; font-family:Arial,Helvetica,sans-serif; font-weight:700; font-size:16px; line-height:20px; color:#ffffff; text-decoration:none; padding:14px 30px; border-radius:999px;">
                          Cambiar contraseña
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Enlace plano -->
                  <p style="margin:16px 0 0 0; font-size:12px; color:#9aa3b2; font-family:Arial,Helvetica,sans-serif;">
                    Si el botón no funciona, copia y pega este enlace en tu navegador:
                  </p>
                  <p style="margin:6px 0 0 0; font-size:12px; color:#6f7a89; word-break:break-all; font-family:Arial,Helvetica,sans-serif;">
                    ${resetUrl}
                  </p>
                </td>
              </tr>

              <!-- Aviso de seguridad (rojo) -->
              <tr>
                <td style="padding:16px 24px;">
                  <table role="presentation" width="100%" style="background:#141822; border-left:4px solid #ff6b6b; border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <p style="margin:0; font-size:13px; color:#ffb3b3; font-family:Arial,Helvetica,sans-serif;">
                          ⚠️ <strong>Aviso de seguridad:</strong> Este enlace expirará en <strong>15 minutos</strong> por tu seguridad.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- ¿No solicitaste esto? (paleta morada) -->
              <tr>
                <td style="padding:12px 24px;">
                  <table role="presentation" width="100%" style="background:#1a1423; border-left:4px solid #6B3FA0; border-radius:10px;">
                    <tr>
                      <td style="padding:14px 16px;">
                        <p style="margin:0; font-size:13px; color:#d7c8f5; font-family:Arial,Helvetica,sans-serif;">
                          💡 <strong>¿No solicitaste esto?</strong> Puedes ignorar este correo, tu contraseña seguirá siendo la misma.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Soporte y Enlaces -->
              <tr>
                <td style="padding:12px 24px;">
                  <div style="background:#1a1423; border-radius:10px; padding:16px;">
                    <h3 style="margin:0 0 12px 0; font-size:16px; color:#dce1ff; font-family:Arial,Helvetica,sans-serif;">Soporte y Enlaces</h3>
                    
                    <div style="margin-bottom:16px;">
                      <h4 style="margin:0 0 8px 0; font-size:14px; color:#d7c8f5; font-family:Arial,Helvetica,sans-serif;">Soporte</h4>
                      <ul style="margin:0 0 0 18px; color:#b5bdd1; font-size:13px; font-family:Arial,Helvetica,sans-serif;">
                        <li>Chat del sitio web</li>
                        <li>WhatsApp: +57 XXX XXX XXXX</li>
                        <li>Email: support@nightlife.com</li>
                      </ul>
                    </div>
                    
                                         <div style="margin-bottom:16px;">
                       <h4 style="margin:0 0 8px 0; font-size:14px; color:#d7c8f5; font-family:Arial,Helvetica,sans-serif;">Enlaces Importantes</h4>
                       <ul style="margin:0 0 0 18px; color:#b5bdd1; font-size:13px; font-family:Arial,Helvetica,sans-serif;">
                         <li><a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/terms" style="color:#6B3FA0;text-decoration:none;">Términos y Servicio</a></li>
                         <li><a href="${process.env.FRONTEND_BASE_URL || 'http://localhost:3000'}/privacy" style="color:#6B3FA0;text-decoration:none;">Política de Privacidad</a></li>
                       </ul>
                     </div>
                    
                    <p style="margin:0; font-size:12px; color:#9aa3b2; font-family:Arial,Helvetica,sans-serif;">
                      Legal: Esta es tu factura oficial de NightLife. Consérvala para tus registros contables y en caso de cualquier consulta sobre tu compra. Los tickets y menús se envían por separado con sus respectivos códigos QR. NightLife Inc. - NIT: [Tu NIT aquí]
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td align="center" style="padding:24px; background:#111317;">
                  <p style="margin:0; font-size:11px; color:#7a8597; font-family:Arial,Helvetica,sans-serif;">
                    © 2025 NightLife Inc. • Todos los derechos reservados
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}
