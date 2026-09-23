import nodemailer, { Transporter } from 'nodemailer';
import { getSmtpEnv } from './env';

let transporter: Transporter | undefined;

export const getMailTransporter = (): Transporter => {
  const env = getSmtpEnv();
  if (!env.enabled) throw new Error('SMTP is disabled');
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.host,
      port: env.port,
      secure: env.secure,
      requireTLS: !env.secure,
      auth: { user: env.user, pass: env.pass },
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
    });
  }
  return transporter;
};

export const closeMailTransporter = (): void => {
  transporter?.close();
  transporter = undefined;
};
