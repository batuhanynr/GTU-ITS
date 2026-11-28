import test from 'node:test';
import assert from 'node:assert/strict';
import { checkInternshipEligibility } from '../src/utils/eligibility.js';

// Build a curriculum result like parseCurriculumStatusText returns.
function curriculum({ ects, ohs1 = 'BB', ohs2 = 'CB', includeOhs = true, ohsByName = false }) {
  const courses = [{ code: 'MATH101', name: 'Matematik I', grade: 'AA', ects: 6, readable: true }];
  if (includeOhs) {
    courses.push(ohsByName
      ? { code: 'XYZ101', name: 'Occupational Health and Safety I', grade: ohs1, ects: 3, readable: ohs1 !== null }
      : { code: 'ISG101', name: 'OHS I', grade: ohs1, ects: 3, readable: ohs1 !== null });
    courses.push(ohsByName
      ? { code: 'XYZ102', name: 'Occupational Health and Safety II', grade: ohs2, ects: 3, readable: ohs2 !== null }
      : { code: 'ISG102', name: 'OHS II', grade: ohs2, ects: 3, readable: ohs2 !== null });
  }
  return { completedEcts: ects, courses };
}

// Issue #68: boundary values for the ECTS thresholds (70 for Staj 1, 120 for Staj 2).
test('Staj 1 is eligible exactly at 70 ECTS with OHS passed, not at 69', () => {
  assert.equal(checkInternshipEligibility(curriculum({ ects: 70 }), 'STAJ1').status, 'ELIGIBLE');
  const below = checkInternshipEligibility(curriculum({ ects: 69 }), 'STAJ1');
  assert.equal(below.status, 'NOT_ELIGIBLE');
  assert.ok(below.reasons.some(r => r.includes('69 below 70')));
});

test('Staj 2 is eligible exactly at 120 ECTS, not at 119', () => {
  assert.equal(checkInternshipEligibility(curriculum({ ects: 120 }), 'STAJ2').status, 'ELIGIBLE');
  assert.equal(checkInternshipEligibility(curriculum({ ects: 119 }), 'STAJ2').status, 'NOT_ELIGIBLE');
});

test('a failed OHS course makes the student not eligible even with enough ECTS', () => {
  const r = checkInternshipEligibility(curriculum({ ects: 200, ohs2: 'FF' }), 'STAJ1');
  assert.equal(r.status, 'NOT_ELIGIBLE');
  assert.ok(r.reasons.some(r => r.includes('OHS II not passed')));
});

test('missing OHS evidence goes to manual review, not an automatic reject', () => {
  const r = checkInternshipEligibility(curriculum({ ects: 200, includeOhs: false }), 'STAJ1');
  assert.equal(r.status, 'MANUAL_REVIEW');
  assert.equal(r.eligible, null);
});

test('unreadable ECTS goes to manual review', () => {
  const r = checkInternshipEligibility(curriculum({ ects: null }), 'STAJ1');
  assert.equal(r.status, 'MANUAL_REVIEW');
});

test('OHS courses are also matched by name when the code is unknown', () => {
  const r = checkInternshipEligibility(curriculum({ ects: 80, ohsByName: true }), 'STAJ1');
  assert.equal(r.status, 'ELIGIBLE');
});
