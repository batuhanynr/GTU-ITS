import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

// Letter grades that may appear on a curriculum status document.
const GRADES = ['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'FD', 'FF', 'VF', 'NA', 'YT', 'YZ', 'S', 'U', 'G', 'K'];

/**
 * Parse the plain text of a curriculum status document.
 * Returns the student, completed ECTS and course results, and flags any
 * missing or unreadable field under needsReview for manual review.
 */
export function parseCurriculumStatusText(rawText) {
  const text = String(rawText || '').replace(/\r/g, '');
  const needsReview = [];

  // Pull a single labelled field, flagging it when absent or unreadable.
  const field = (re, label) => {
    const m = text.match(re);
    const value = m && m[1] ? m[1].trim() : '';
    if (!value || value.toUpperCase() === 'NOT FOUND') { needsReview.push(label); return null; }
    return value;
  };

  const studentId = field(/Öğrenci\s*Numaras[ıIi]\s*:\s*([0-9]+)/i, 'studentId');
  const name = field(/Ad[ıIi]\s*Soyad[ıIi]\s*:\s*([^\n]+)/i, 'name');

  const ectsMatch = text.match(/Tamamlanan\s*(?:AKTS|ECTS)\s*:\s*([0-9]+)/i);
  const completedEcts = ectsMatch ? Number(ectsMatch[1]) : null;
  if (!ectsMatch) needsReview.push('completedEcts');

  const codeRe = /^([A-Z]{2,4})\s?(\d{3})\b/i;
  // A course row ends with "<grade> <ects>"; anything else is unreadable.
  const tailRe = new RegExp(`\\b(${GRADES.join('|')})\\s+(\\d{1,2})\\s*$`, 'i');

  const courses = [];
  for (const line of text.split('\n')) {
    const row = line.trim();
    const codeM = row.match(codeRe);
    if (!codeM) continue; // not a course row
    const code = (codeM[1] + codeM[2]).toUpperCase();
    const tailM = row.match(tailRe);
    if (!tailM) {
      // A course we recognised by code but could not fully read -> manual review.
      needsReview.push(`course:${code}`);
      courses.push({ code, name: row.slice(codeM[0].length).trim() || null, grade: null, ects: null, readable: false });
      continue;
    }
    courses.push({
      code,
      name: row.slice(codeM[0].length, tailM.index).trim() || null,
      grade: tailM[1].toUpperCase(),
      ects: Number(tailM[2]),
      readable: true,
    });
  }
  if (courses.length === 0) needsReview.push('courses');

  return { studentId, name, completedEcts, courses, needsReview, complete: needsReview.length === 0 };
}

/** Read a curriculum status PDF buffer and parse its text. */
export async function parseCurriculumStatusPdf(buffer) {
  const data = await pdf(buffer);
  return parseCurriculumStatusText(data.text);
}
