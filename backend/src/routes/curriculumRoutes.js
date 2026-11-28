import express from 'express';
import multer from 'multer';
import { authenticateToken, requireRole } from '../middlewares/auth.js';
import { parseCurriculum } from '../controllers/curriculumController.js';

const router = express.Router();

// Store the uploaded PDF in memory; only PDFs are accepted.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  }
});

router.post('/curriculum/parse-pdf', authenticateToken, requireRole(['General Admin', 'Commission Chair', 'Commission Member']), upload.single('file'), parseCurriculum);

export default router;
