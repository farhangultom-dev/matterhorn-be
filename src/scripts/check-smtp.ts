import { getMailTransporter, closeMailTransporter } from '../config/mail';
import { getSmtpEnv } from '../config/env';

const checkSmtp = async (): Promise<void> => {
  try {
    const env = getSmtpEnv();
    if (!env.enabled) {
      console.log('SMTP connection: skipped (SMTP_ENABLED=false)');
      return;
    }
    await getMailTransporter().verify();
    console.log('SMTP connection: ok');
  } finally {
    closeMailTransporter();
  }
};

checkSmtp().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'SMTP verification failed');
  process.exitCode = 1;
});
