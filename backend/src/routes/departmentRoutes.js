import express from 'express';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { memberScope } from '../middlewares/memberScope.js';
import {
    getAllDepartments,
    getDepartmentChair,
    createCommissionChair,
    removeCommissionChair,
    getCommissionChairs,
    assignCommissionChair,
    getCommissionStatus,
    getDepartmentMembers,
    createCommissionMember,
    removeCommissionMember
} from '../controllers/departmentController.js';

const router = express.Router();
router.use(authenticateToken);

// Department routes
router.get('/departments', getAllDepartments);

// Commission Chair routes
router.get('/department-chair/:departmentId', requireRole(['General Admin']), getDepartmentChair);
router.post('/create-commission-chair', requireRole(['General Admin']), createCommissionChair);
router.delete('/remove-commission-chair/:userId', requireRole(['General Admin']), removeCommissionChair);
router.get('/commission-chairs', requireRole(['General Admin']), getCommissionChairs);
router.post('/assign-commission-chair', requireRole(['General Admin']), assignCommissionChair);

// Commission Member routes
router.get('/department-members/:departmentId', requireRole(['General Admin', 'Commission Chair']), memberScope, getDepartmentMembers);
router.post('/create-commission-member', requireRole(['General Admin', 'Commission Chair']), memberScope, createCommissionMember);
router.delete('/remove-commission-member/:userId', requireRole(['General Admin', 'Commission Chair']), memberScope, removeCommissionMember);

// Commission Status
router.get('/commission-status', requireRole(['General Admin']), getCommissionStatus);

export default router;
