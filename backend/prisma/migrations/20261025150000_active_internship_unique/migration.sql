-- At most one active (ungraded) or passed (S) internship per student per type, across all terms.
-- A failed (U) internship is excluded so it can be retaken in a later term.
-- This closes the race where two parallel creates in different terms both pass the app check.
CREATE UNIQUE INDEX "Internship_active_or_passed_unique"
  ON "Internship" ("studentId", "internshipOrder")
  WHERE grade IS NULL OR grade = 'S';
