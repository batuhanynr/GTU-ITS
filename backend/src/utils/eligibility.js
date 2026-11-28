// Internship eligibility rules.
//
// NOTE: these thresholds are the values PROPOSED in the first presentation and are
// PENDING ADVISOR CONFIRMATION. They are kept here as a single config so they can be
// changed in one place once confirmed.
export const ELIGIBILITY_CONFIG = {
  // Minimum completed ECTS required per internship type.
  ectsThreshold: { STAJ1: 70, STAJ2: 120 },
  // Occupational Health and Safety I & II must be passed. Courses are matched by code
  // first, then by a name pattern as a fallback (codes also pending confirmation).
  ohsCourses: [
    { level: 'I', codes: ['ISG101'], namePattern: /(sa[gğ]l[ıi][gğ].*g[üu]venli|occupational health.*safety)\s*i\b/i },
    { level: 'II', codes: ['ISG102'], namePattern: /(sa[gğ]l[ıi][gğ].*g[üu]venli|occupational health.*safety)\s*ii\b/i },
  ],
};

// Grades that count as passed. Anything else (FF, FD, VF, NA, U, K, YZ, ...) is a fail.
const PASSING_GRADES = new Set(['AA', 'BA', 'BB', 'CB', 'CC', 'DC', 'DD', 'S', 'G', 'YT', 'M']);

/**
 * Decide whether a student is eligible for an internship from parsed curriculum data.
 * Returns ELIGIBLE / NOT_ELIGIBLE, or MANUAL_REVIEW when required evidence is missing
 * or unreadable (so it can be checked by a human instead of wrongly rejected).
 */
export function checkInternshipEligibility(curriculum, internshipType, config = ELIGIBILITY_CONFIG) {
  const threshold = config.ectsThreshold[internshipType];
  if (threshold === undefined) {
    return { eligible: false, status: 'NOT_ELIGIBLE', reasons: ['Unknown internship type'], threshold: null };
  }

  const courses = (curriculum && curriculum.courses) || [];
  const reasons = [];
  let manualReview = false;

  // Completed ECTS must be readable and meet the threshold.
  const ects = curriculum ? curriculum.completedEcts : null;
  if (ects === null || ects === undefined) {
    reasons.push('completedEcts unreadable'); manualReview = true;
  } else if (ects < threshold) {
    reasons.push(`completedEcts ${ects} below ${threshold}`);
  }

  // Occupational Health and Safety I & II must both be present, readable and passed.
  for (const ohs of config.ohsCourses) {
    const match = courses.find(c => ohs.codes.includes(c.code) || (c.name && ohs.namePattern.test(c.name)));
    if (!match) { reasons.push(`OHS ${ohs.level} not found`); manualReview = true; continue; }
    if (!match.readable || match.grade === null) { reasons.push(`OHS ${ohs.level} grade unreadable`); manualReview = true; continue; }
    if (!PASSING_GRADES.has(match.grade)) { reasons.push(`OHS ${ohs.level} not passed (${match.grade})`); }
  }

  // Missing or unreadable evidence goes to manual review rather than an automatic reject.
  if (manualReview) {
    return { eligible: null, status: 'MANUAL_REVIEW', reasons, threshold };
  }
  const eligible = reasons.length === 0;
  return { eligible, status: eligible ? 'ELIGIBLE' : 'NOT_ELIGIBLE', reasons, threshold };
}
