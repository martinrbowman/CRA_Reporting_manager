import nodemailer from 'nodemailer';
import { eq } from 'drizzle-orm';

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

export function createTransport(cfg: SmtpConfig) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
}

export async function sendTestEmail(cfg: SmtpConfig, to: string): Promise<void> {
  const transport = createTransport(cfg);
  await transport.verify();
  await transport.sendMail({
    from: cfg.from,
    to,
    subject: 'CRA Platform — SMTP test',
    text: 'SMTP configuration is working correctly.',
  });
}

// Single source of truth for SMTP config: platform_settings (DB, editable via
// Settings UI) falling back to env vars. All callers — including the
// notification /send route — must go through this, not build their own
// nodemailer transport from raw env vars.
export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const { db } = await import('../db/index.js');
  const { platformSettings } = await import('../db/schema.js');
  const [row] = await db.select().from(platformSettings).where(eq(platformSettings.key, 'smtp')).limit(1);
  if (row) return row.value as SmtpConfig;
  return envSmtpConfig();
}

export async function sendNotificationEmail(
  subject: string,
  body: string,
  to: string[],
): Promise<{ messageId: string } | null> {
  const cfg = await getSmtpConfig();
  if (!cfg || !cfg.host) return null;
  const transport = createTransport(cfg);
  const info = await transport.sendMail({ from: cfg.from, to, subject, text: body });
  return { messageId: info.messageId };
}

function envSmtpConfig(): SmtpConfig | null {
  const host = process.env['SMTP_HOST'];
  if (!host) return null;
  return {
    host,
    port: Number(process.env['SMTP_PORT'] ?? 587),
    secure: process.env['SMTP_SECURE'] === 'true',
    user: process.env['SMTP_USER'] ?? '',
    pass: process.env['SMTP_PASS'] ?? '',
    from: process.env['SMTP_FROM'] ?? 'cra@localhost',
  };
}
