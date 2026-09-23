import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.middleware';
import { validateBody } from '../middlewares/validate.middleware';
import { loginController, meController, registerController, resendVerificationOtpController, verifyEmailController } from '../controllers/auth.controller';
import { loginSchema, registerSchema, resendVerificationOtpSchema, verifyEmailSchema } from '../validations/auth.validation';

const router = Router();
router.post('/register', validateBody(registerSchema), registerController);
router.post('/login', validateBody(loginSchema), loginController);
router.post('/verify-email', validateBody(verifyEmailSchema), verifyEmailController);
router.post('/resend-verification-otp', validateBody(resendVerificationOtpSchema), resendVerificationOtpController);
router.get('/me', authenticate, meController);

export default router;
