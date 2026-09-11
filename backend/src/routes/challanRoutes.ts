import { Router } from 'express';
import {
  getChallans,
  getChallanById,
  createChallan,
  confirmDraftChallan,
  cancelChallan
} from '../controllers/challanController';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';

const router = Router();

// All challan routes require authentication
router.use(requireAuth);

// Read endpoints accessible to all authenticated roles
router.get('/', getChallans);
router.get('/:id', getChallanById);

// Create, confirm, and cancel accessible to Admin and Sales
router.post('/', requireRole('Admin', 'Sales'), createChallan);
router.put('/:id/confirm', requireRole('Admin', 'Sales'), confirmDraftChallan);
router.post('/:id/confirm', requireRole('Admin', 'Sales'), confirmDraftChallan);
router.put('/:id/cancel', requireRole('Admin', 'Sales'), cancelChallan);
router.post('/:id/cancel', requireRole('Admin', 'Sales'), cancelChallan);

export default router;
