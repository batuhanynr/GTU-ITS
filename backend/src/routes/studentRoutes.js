import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import {
    getAllTerms,
    getStudentsByDepartmentAndTerm,
    getStudentDetails,
    upsertStudent
} from '../controllers/studentController.js';

const router = express.Router();
router.use(authenticateToken, requireRole(['General Admin', 'Commission Chair', 'Commission Member']));

// Term routes
router.get('/terms', getAllTerms);

// Student routes
router.get('/students/:departmentId/:termId', getStudentsByDepartmentAndTerm);
router.get('/student/:studentId', getStudentDetails);
router.post('/student', upsertStudent);

export default router;
