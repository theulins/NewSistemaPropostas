import express from 'express';
import rateLimit from 'express-rate-limit';
import { login, profile } from './controllers/authController.js';
import { getSummary, getCommissions } from './controllers/dashboardController.js';
import { listRecent, searchCompanies, createCompany } from './controllers/companiesController.js';
import { listPending, approvePending, rejectPending } from './controllers/pendingController.js';
import { getSettings, updateSettings } from './controllers/settingsController.js';
import { listUsers, createUser, updateUser, deleteUser } from './controllers/usersController.js';
import { authMiddleware } from './middleware/authMiddleware.js';
import { roleGuard } from './middleware/roleGuard.js';
import { asyncHandler } from './utils/asyncHandler.js';

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.post('/login', loginLimiter, asyncHandler(login));
router.get('/profile', authMiddleware, asyncHandler(profile));

router.get('/dashboard/summary', authMiddleware, asyncHandler(getSummary));
router.get('/dashboard/commissions', authMiddleware, asyncHandler(getCommissions));

router.get('/empresas/list', authMiddleware, asyncHandler(listRecent));
router.get('/empresas/search', authMiddleware, asyncHandler(searchCompanies));
router.post('/empresas', authMiddleware, roleGuard('editor', 'admin'), asyncHandler(createCompany));

router.get('/empresas/pending', authMiddleware, asyncHandler(listPending));
router.get('/empresas/pending/search', authMiddleware, asyncHandler(listPending));
router.post(
  '/empresas/pending/approve',
  authMiddleware,
  roleGuard('editor', 'admin'),
  asyncHandler(approvePending)
);
router.post(
  '/empresas/pending/reject',
  authMiddleware,
  roleGuard('editor', 'admin'),
  asyncHandler(rejectPending)
);

router.get('/settings', authMiddleware, asyncHandler(getSettings));
router.put('/settings', authMiddleware, roleGuard('admin'), asyncHandler(updateSettings));

router.get('/users', authMiddleware, roleGuard('admin'), asyncHandler(listUsers));
router.post('/users', authMiddleware, roleGuard('admin'), asyncHandler(createUser));
router.put('/users/:id', authMiddleware, roleGuard('admin'), asyncHandler(updateUser));
router.delete('/users/:id', authMiddleware, roleGuard('admin'), asyncHandler(deleteUser));

export default router;
