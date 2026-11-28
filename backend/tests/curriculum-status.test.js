import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCurriculumStatusText } from '../src/utils/curriculumStatus.js';

// Issue #67: read course results and completed ECTS, and flag missing/unreadable fields.

const COMPLETE = `GEBZE TEKNİK ÜNİVERSİTESİ
Müfredat Durum Belgesi
Öğrenci Numarası: 220104004001
Adı Soyadı: Ada Lovelace
Tamamlanan AKTS: 145

Ders Kodu   Ders Adı                      Not   AKTS
MATH101     Matematik I                   AA    6
PHYS101     Fizik I                       BA    6
ISG101      Is Sagligi ve Guvenligi I     BB    3
ISG102      Is Sagligi ve Guvenligi II    CB    3
CENG211     Veri Yapilari                 BB    7`;

// Missing "Tamamlanan AKTS" line and one course row without a grade.
const INCOMPLETE = `GEBZE TEKNİK ÜNİVERSİTESİ
Müfredat Durum Belgesi
Öğrenci Numarası: 220104004002
Adı Soyadı: Alan Turing

Ders Kodu   Ders Adı        Not   AKTS
MATH101     Matematik I     AA    6
PHYS101     Fizik I               6
CENG211     Veri Yapilari   BB    7`;

test('a complete curriculum status is fully parsed with no manual review', () => {
  const r = parseCurriculumStatusText(COMPLETE);
  assert.equal(r.studentId, '220104004001');
  assert.equal(r.name, 'Ada Lovelace');
  assert.equal(r.completedEcts, 145);
  assert.equal(r.courses.length, 5);
  assert.ok(r.courses.every(c => c.readable));
  const isg = r.courses.filter(c => c.code.startsWith('ISG'));
  assert.equal(isg.length, 2);
  assert.deepEqual(isg.map(c => c.grade), ['BB', 'CB']);
  assert.deepEqual(r.needsReview, []);
  assert.equal(r.complete, true);
});

test('an incomplete curriculum status flags missing ECTS and an unreadable course', () => {
  const r = parseCurriculumStatusText(INCOMPLETE);
  assert.equal(r.studentId, '220104004002');
  assert.equal(r.completedEcts, null);
  assert.ok(r.needsReview.includes('completedEcts'));
  assert.ok(r.needsReview.includes('course:PHYS101'));
  const phys = r.courses.find(c => c.code === 'PHYS101');
  assert.equal(phys.readable, false);
  assert.equal(phys.grade, null);
  // The readable courses are still returned.
  assert.equal(r.courses.filter(c => c.readable).length, 2);
  assert.equal(r.complete, false);
});
