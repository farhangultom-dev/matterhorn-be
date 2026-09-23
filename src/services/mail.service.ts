import { getMailTransporter } from '../config/mail';
import { getSmtpEnv } from '../config/env';

export interface EmailInput {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

export const sendEmail = async (input: EmailInput): Promise<void> => {
  const { from } = getSmtpEnv();
  await getMailTransporter().sendMail({ from, to: input.to, subject: input.subject, text: input.text, html: input.html });
};

export const sendVerificationEmail = async ({ to, otp }: { to: string; otp: string }): Promise<void> => {
  await sendEmail({
    to,
    subject: 'Verify your Combathub email',
    text: 'Your Combathub verification code is ' + otp + '. It expires in 10 minutes.',
  });
};
