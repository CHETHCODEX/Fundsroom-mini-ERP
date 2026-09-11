import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  adjustStock,
  getStockMovements
} from '../controllers/productController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// All routes require authentication
router.use(requireAuth);

// Product read endpoints accessible to all authenticated roles
router.get('/', getProducts);
router.get('/movements', getStockMovements);
router.get('/:id', getProductById);

// Creation and stock adjustments accessible to Admin and Warehouse (Sales can read only)
router.post('/', requireRole('Admin', 'Warehouse'), createProduct);
router.put('/:id', requireRole('Admin', 'Warehouse'), updateProduct);
router.post('/:id/adjust-stock', requireRole('Admin', 'Warehouse'), adjustStock);

export default router;
