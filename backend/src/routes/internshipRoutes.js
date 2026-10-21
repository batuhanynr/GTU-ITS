import express from 'express';
import multer from 'multer';
import {
  parsePdf,
  createInternship,
  getInternships,
  updateInternship,
  deleteInternship,
  generateCommissionReport
} from '../controllers/internshipController.js';
import { authenticateToken, requireRole } from '../middlewares/auth.js';

const router = express.Router();

// Configure multer for file uploads (store in memory)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// Authenticate before accepting document uploads.
router.post('/internship/parse-pdf', authenticateToken, requireRole(['General Admin', 'Commission Chair', 'Commission Member']), upload.single('file'), parsePdf);

// Create internship from parsed data (requires authentication)
router.post('/internship/create', authenticateToken, requireRole(['Commission Chair', 'Commission Member', 'General Admin']), createInternship);

// Get internships with filters
router.get('/internships', authenticateToken, getInternships);

// Update internship
router.put('/internship/:id', authenticateToken, requireRole(['Commission Chair', 'Commission Member', 'General Admin']), updateInternship);

// Delete internship
router.delete('/internship/:id', authenticateToken, requireRole(['Commission Chair', 'General Admin']), deleteInternship);

// Generate commission evaluation report
router.post('/internship/generate-report', authenticateToken, requireRole(['Commission Chair', 'Commission Member', 'General Admin']), generateCommissionReport);

export default router;
