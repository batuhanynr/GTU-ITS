import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { createUser, getAllUsers } from '../controllers/userController.js';

const router = express.Router();

// Limit admin checks to account routes so other mounted APIs remain reachable.
router.post('/kullanici', authenticateToken, requireRole(['General Admin']), createUser);
router.get('/kullanicilar', authenticateToken, requireRole(['General Admin']), getAllUsers);

export default router;
