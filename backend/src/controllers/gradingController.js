import { departmentAccess } from '../utils/departmentAccess.js';
import prisma from '../config/prisma.js';

/**
 * Grade an internship
 * POST /api/grade-internship
 * Body: { internshipId, studentId, internshipOrder, grade, gradeComment? }
 */
export async function gradeInternship(req, res) {
  try {
    const { internshipId, grade, gradeComment } = req.body;

    // Grade a specific internship by its id so the exact record is targeted.
    if (!internshipId || !grade) {
      return res.status(400).json({
        error: 'Missing required fields: internshipId and grade are required',
      });
    }

    // Validate grade value
    if (!['S', 'U'].includes(grade)) {
      return res.status(400).json({ error: 'Grade must be either "S" or "U"' });
    }

    const target = await prisma.internship.findUnique({
      where: { id: Number(internshipId) }, include: { student: true }
    });
    if (!target) return res.status(404).json({ error: 'Internship not found' });
    if (!await departmentAccess(req, res, target.student.departmentId)) return;

    // Update the internship with grade and optional comment
    const updatedInternship = await prisma.internship.update({
      where: { id: target.id },
      data: {
        grade,
        gradeComment: gradeComment || null,
        status: 'COMPLETED', // Mark as completed when graded
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.json({
      message: 'Internship graded successfully',
      internship: updatedInternship,
    });
  } catch (error) {
    console.error('Error grading internship:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Internship not found' });
    }

    return res.status(500).json({ error: 'Failed to grade internship' });
  }
}

/**
 * Bulk grade multiple internships
 * POST /api/grade-internships-bulk
 * Body: { grades: [{ studentId, internshipOrder, grade, gradeComment? }] }
 */
export async function bulkGradeInternships(req, res) {
  try {
    console.log('Bulk grade request received:', JSON.stringify(req.body, null, 2));
    const { grades } = req.body;

    if (!Array.isArray(grades) || grades.length === 0) {
      console.log('Invalid grades array:', grades);
      return res.status(400).json({ error: 'grades array is required and must not be empty' });
    }

    const results = [];
    const errors = [];

    // Process each grade
    for (const gradeData of grades) {
      // A null/malformed row becomes a per-row error instead of a 500 after partial writes.
      if (!gradeData || typeof gradeData !== 'object') {
        errors.push({ error: 'Malformed grade row' });
        continue;
      }
      const { internshipId, studentId, internshipOrder, grade, gradeComment } = gradeData;
      console.log(`Processing grade for internship ${internshipId} (student ${studentId})`);

      // internshipId identifies the exact record; studentId/order are kept only for error context.
      if (!internshipId || !grade) {
        errors.push({
          internshipId,
          studentId,
          internshipOrder,
          error: 'Missing required fields',
        });
        continue;
      }

      // Validate grade value
      if (!['S', 'U'].includes(grade)) {
        errors.push({
          internshipId,
          studentId,
          internshipOrder,
          error: 'Grade must be either "S" or "U"',
        });
        continue;
      }

      try {
        const target = await prisma.internship.findUnique({
          where: { id: Number(internshipId) }, include: { student: true }
        });
        if (!target) {
          errors.push({ internshipId, studentId, internshipOrder, error: 'Internship not found' });
          continue;
        }
        let accessError;
        const accessResponse = { status: () => ({ json: value => { accessError = value.error; } }) };
        if (!await departmentAccess(req, accessResponse, target.student.departmentId)) {
          errors.push({ internshipId, studentId, internshipOrder, error: accessError });
          continue;
        }
        const updatedInternship = await prisma.internship.update({
          where: { id: target.id },
          data: {
            grade,
            gradeComment: gradeComment || null,
            status: 'COMPLETED',
          },
        });

        results.push({
          internshipId,
          studentId,
          internshipOrder,
          success: true,
        });
      } catch (error) {
        console.error(`Error grading internship ${internshipId} (student ${studentId}):`, error);
        console.error('Error details:', { code: error.code, message: error.message });
        errors.push({
          internshipId,
          studentId,
          internshipOrder,
          error: error.code === 'P2025' ? 'Internship not found' : 'Failed to grade',
          details: error.message
        });
      }
    }

    console.log(`Bulk grading completed: ${results.length} success, ${errors.length} errors`);
    if (errors.length > 0) {
      console.log('Errors:', JSON.stringify(errors, null, 2));
    }

    return res.json({
      message: 'Bulk grading completed',
      successCount: results.length,
      errorCount: errors.length,
      results,
      errors,
    });
  } catch (error) {
    console.error('Error in bulk grading:', error);
    return res.status(500).json({ error: 'Failed to process bulk grading' });
  }
}
