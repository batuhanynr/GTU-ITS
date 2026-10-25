-- DropIndex
DROP INDEX "Internship_studentId_internshipOrder_key";

-- CreateIndex
CREATE UNIQUE INDEX "Internship_studentId_internshipOrder_termId_key" ON "Internship"("studentId", "internshipOrder", "termId");
