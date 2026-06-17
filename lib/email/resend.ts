import { Resend } from 'resend';
import { getServerEnv } from '@/lib/env';
import type { EmailMessage, EmailSender } from '@/lib/api/ports';

/**
 * Invio email via Resend. `createEmailSender` degrada a un sender di logging se
 * non è configurata la RESEND_API_KEY (sviluppo/test), così la route gira anche
 * senza credenziali e l'invio resta best-effort.
 */

export class ResendEmailSender implements EmailSender {
  private readonly client: Resend;
  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
    if (error) throw new Error(`Resend: ${error.message}`);
  }
}

export class LoggingEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `[email:log] to=${message.to} subject="${message.subject}" (${message.html.length} bytes)`,
    );
  }
}

export function createEmailSender(): EmailSender {
  const env = getServerEnv();
  if (env.RESEND_API_KEY && env.EMAIL_FROM) {
    return new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM);
  }
  return new LoggingEmailSender();
}
