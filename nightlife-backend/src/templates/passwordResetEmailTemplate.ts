// src/templates/passwordResetEmailTemplate.ts
export function generatePasswordResetEmailHTML({
  resetUrl,
}: {
  resetUrl: string;
}): string {
  return `
  <div style="font-family: Arial, sans-serif; background: #111; color: white; padding: 20px; border-radius: 12px; max-width: 500px; margin: auto;">
    <h1 style="text-align: center; font-size: 28px; color: #8b5cf6;">🔐 Reset Your Password</h1>
    
    <div style="background: #1f1f1f; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6;">
      <p style="margin: 0 0 15px 0; font-size: 16px; line-height: 1.5;">
        We received a request to reset your NightLife account password. Click the button below to create a new password:
      </p>
      
      <div style="text-align: center; margin: 25px 0;">
        <a href="${resetUrl}" 
           style="display: inline-block; background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; font-size: 16px;">
          Reset Password
        </a>
      </div>
      
      <p style="margin: 15px 0 0 0; font-size: 14px; color: #a1a1aa;">
        If the button doesn't work, copy and paste this link into your browser:
      </p>
      <p style="margin: 10px 0 0 0; font-size: 12px; color: #6b7280; word-break: break-all;">
        ${resetUrl}
      </p>
    </div>
    
    <div style="background: #1f1f1f; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
      <p style="margin: 0; font-size: 14px; color: #fca5a5;">
        ⚠️ <strong>Security Notice:</strong> This link will expire in 15 minutes for your security.
      </p>
    </div>
    
    <div style="background: #1f1f1f; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 14px; color: #a7f3d0;">
        💡 <strong>Didn't request this?</strong> You can safely ignore this email. Your password will remain unchanged.
      </p>
    </div>
    
    <p style="font-size: 12px; color: #777; text-align: center; margin-top: 30px;">
      © 2025 NightLife Inc. | All rights reserved
    </p>
  </div>
  `;
}
