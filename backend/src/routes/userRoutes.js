import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { createUser, getAllUsers } from '../controllers/userController.js';

const router = express.Router();
router.use(authenticateToken, requireRole(['General Admin']));

router.post('/kullanici', createUser);
router.get('/kullanicilar', getAllUsers);

export default router;
