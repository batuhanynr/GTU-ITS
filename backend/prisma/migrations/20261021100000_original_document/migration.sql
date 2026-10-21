CREATE TABLE "InternshipDocument" (
    "id" SERIAL NOT NULL,
    "internshipId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    CONSTRAINT "InternshipDocument_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "InternshipDocument_internshipId_key" ON "InternshipDocument"("internshipId");
ALTER TABLE "InternshipDocument" ADD CONSTRAINT "InternshipDocument_internshipId_fkey"
    FOREIGN KEY ("internshipId") REFERENCES "Internship"("id") ON DELETE CASCADE ON UPDATE CASCADE;
