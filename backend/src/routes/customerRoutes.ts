import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  addCustomerNote
} from '../controllers/customerController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// All customer routes require authentication
router.use(requireAuth);

// Read endpoints accessible to all authenticated roles (Admin, Sales, Warehouse, Accounts)
router.get('/', getCustomers);
router.get('/:id', getCustomerById);

// Modification endpoints restricted to Admin and Sales roles
router.post('/', requireRole('Admin', 'Sales'), createCustomer);
router.put('/:id', requireRole('Admin', 'Sales'), updateCustomer);
router.post('/:id/notes', requireRole('Admin', 'Sales'), addCustomerNote);

export default router;
