import { Router } from 'express';
import authRoutes from './auth.routes';
import healthRoutes from './health.routes';
import userDetailsRoutes from './user-details.routes';
import provinceRoutes from './province.routes';
import roleRoutes from './role.routes';
import userRoleRoutes from './user-role.routes';
import disciplineSportRoutes from './discipline-sport.routes';
import communityRoutes from './community.routes';
import organizerRoutes from './organizer.routes';
import eventRoutes from './event.routes';
import paymentRoutes from './payment.routes';

const router = Router();
router.use('/health', healthRoutes);
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userDetailsRoutes);
router.use('/api/v1/provinces', provinceRoutes);
router.use('/api/v1/roles', roleRoutes);
router.use('/api/v1/user-roles', userRoleRoutes);
router.use('/api/v1/discipline-sports', disciplineSportRoutes);
router.use('/api/v1/communities', communityRoutes);
router.use('/api/v1/organizers', organizerRoutes);
router.use('/api/v1/events', eventRoutes);
router.use('/api/v1/payments', paymentRoutes);

export default router;
