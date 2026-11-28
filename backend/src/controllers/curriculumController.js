import { parseCurriculumStatusPdf } from '../utils/curriculumStatus.js';
import { checkInternshipEligibility } from '../utils/eligibility.js';

/**
 * Parse an uploaded curriculum status PDF.
 * POST /api/curriculum/parse-pdf  (multipart: field 'file')
 */
export async function parseCurriculum(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const data = await parseCurriculumStatusPdf(req.file.buffer);
    // data.needsReview lists missing/unreadable fields for manual review.
    return res.json({ success: true, data });
  } catch (error) {
    console.error('Error parsing curriculum status:', error);
    return res.status(500).json({ error: 'Failed to parse curriculum status', details: error.message });
  }
}

/**
 * Parse a curriculum status PDF and decide internship eligibility.
 * POST /api/curriculum/eligibility  (multipart: field 'file', body: internshipType)
 */
export async function checkEligibility(req, res) {
  try {
    const { internshipType } = req.body;
    if (!['STAJ1', 'STAJ2'].includes(internshipType)) {
      return res.status(400).json({ error: 'internshipType must be STAJ1 or STAJ2' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const curriculum = await parseCurriculumStatusPdf(req.file.buffer);
    const eligibility = checkInternshipEligibility(curriculum, internshipType);
    // status is ELIGIBLE / NOT_ELIGIBLE / MANUAL_REVIEW; reasons explain the decision.
    return res.json({ success: true, curriculum, eligibility });
  } catch (error) {
    console.error('Error checking eligibility:', error);
    return res.status(500).json({ error: 'Failed to check eligibility', details: error.message });
  }
}
