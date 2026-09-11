import { Router } from 'express';
import authRoutes from './authRoutes';
import customerRoutes from './customerRoutes';
import productRoutes from './productRoutes';
import challanRoutes from './challanRoutes';
import dashboardRoutes from './dashboardRoutes';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/challans', challanRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

export default apiRouter;
