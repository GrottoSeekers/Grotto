const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Email failed to send${body ? `: ${body}` : ''}.`);
  }
}

export function passwordResetEmail(code: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#fff;">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#C9A84C;letter-spacing:1px;margin:0 0 28px;">Grotto</p>
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#1A1A1A;margin:0 0 12px;">Reset your password</h1>
      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
        We received a request to reset your Grotto password. Enter the code below in the app to choose a new password.
      </p>
      <div style="background:#F7F5F0;border-radius:12px;padding:24px;text-align:center;margin:0 0 28px;">
        <p style="font-size:13px;color:#999;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Your reset code</p>
        <p style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1A1A1A;margin:0;">${code}</p>
      </div>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0;">
        This code is valid for your current session. If you didn't request a password reset, you can safely ignore this email.
      </p>
    </div>
  `;
}

export function emailVerificationEmail(name: string, code: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;background:#fff;">
      <p style="font-family:Georgia,serif;font-size:22px;font-weight:bold;color:#C9A84C;letter-spacing:1px;margin:0 0 28px;">Grotto</p>
      <h1 style="font-family:Georgia,serif;font-size:26px;color:#1A1A1A;margin:0 0 12px;">Verify your email</h1>
      <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
        Hi ${name}, welcome to Grotto! Enter the code below in the app to activate your account.
      </p>
      <div style="background:#F7F5F0;border-radius:12px;padding:24px;text-align:center;margin:0 0 28px;">
        <p style="font-size:13px;color:#999;margin:0 0 8px;text-transform:uppercase;letter-spacing:1px;">Your verification code</p>
        <p style="font-size:40px;font-weight:700;letter-spacing:12px;color:#1A1A1A;margin:0;">${code}</p>
      </div>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0;">
        If you didn't create a Grotto account, you can safely ignore this email.
      </p>
    </div>
  `;
}
