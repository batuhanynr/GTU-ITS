import { parseCurriculumStatusPdf } from '../utils/curriculumStatus.js';

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
