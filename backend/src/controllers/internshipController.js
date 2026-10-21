import { departmentAccess } from '../utils/departmentAccess.js';
import prisma from '../config/prisma.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } from 'docx';

/**
 * Parse internship PDF file
 * POST /api/internship/parse-pdf
 * Body: multipart/form-data with 'file' field
 */
export async function parsePdf(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('Parsing PDF file:', req.file.originalname);
    
    const parsedData = await parseInternshipPdf(req.file.buffer);
    console.log('PDF parsed successfully:', parsedData);
    
    return res.json({ 
      success: true, 
      data: parsedData 
    });
  } catch (error) {
    console.error('Error parsing PDF:', error);
    return res.status(500).json({ 
      error: 'Failed to parse PDF', 
      details: error.message 
    });
  }
}

/**
 * Create internship from parsed data (after user approval)
 * POST /api/internship/create
 * Body: { studentId, studentName, companyName, contactName, contactPosition, 
 *         startDate, endDate, duration, internshipType, termId, isErasmus }
 */
export async function createInternship(req, res) {
  try {
    const {
      studentId,
      studentName,
      studentEmail,
      studentPhone,
      companyName,
      contactName,
      contactPosition,
      startDate,
      endDate,
      duration,
      internshipType, // 'STAJ1' or 'STAJ2'
      termId,
      isErasmus = false,
      departmentId,
      reportUrl,
      documentUrl
    } = req.body;

    if (!await departmentAccess(req, res, departmentId)) return;
    const existingStudent = await prisma.student.findUnique({ where: { id: studentId } });
    if (existingStudent && !await departmentAccess(req, res, existingStudent.departmentId)) return;

    console.log('Creating internship:', { studentId, companyName, internshipType });

    // Validate required fields
    if (!studentId || !companyName || !startDate || !endDate || !internshipType || !termId || !departmentId) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['studentId', 'companyName', 'startDate', 'endDate', 'internshipType', 'termId', 'departmentId']
      });
    }

    // Validate internship type
    if (!['STAJ1', 'STAJ2'].includes(internshipType)) {
      return res.status(400).json({ error: 'internshipType must be STAJ1 or STAJ2' });
    }

    // If STAJ2, check if STAJ1 exists and is passed (grade = 'S')
    if (internshipType === 'STAJ2') {
      const staj1 = await prisma.internship.findUnique({
        where: {
          studentId_internshipOrder: {
            studentId,
            internshipOrder: 'STAJ1'
          }
        }
      });

      if (!staj1) {
        return res.status(400).json({ 
          error: 'Student must complete STAJ1 before registering for STAJ2' 
        });
      }

      if (staj1.grade !== 'S') {
        return res.status(400).json({ 
          error: 'Student must pass STAJ1 (grade = S) before registering for STAJ2' 
        });
      }
    }

    // Check if student already has this internship type
    const existingInternship = await prisma.internship.findUnique({
      where: {
        studentId_internshipOrder: {
          studentId,
          internshipOrder: internshipType
        }
      }
    });

    if (existingInternship) {
      return res.status(400).json({ 
        error: `Student already has ${internshipType} registered` 
      });
    }

    // Convert dates from DD.MM.YYYY to ISO format
    const parsedStartDate = parseDate(startDate);
    const parsedEndDate = parseDate(endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use DD.MM.YYYY' 
      });
    }

    // Upsert student (create if not exists, update if exists)
    await prisma.student.upsert({
      where: { id: studentId },
      update: {
        name: studentName,
        email: studentEmail || `${studentId}@example.com`,
        phone_number: studentPhone || '',
        departmentId: parseInt(departmentId)
      },
      create: {
        id: studentId,
        name: studentName,
        email: studentEmail || `${studentId}@example.com`,
        phone_number: studentPhone || '',
        departmentId: parseInt(departmentId)
      }
    });

    // Upsert company (create if not exists)
    const company = await prisma.company.upsert({
      where: { name: companyName },
      update: {},
      create: { name: companyName }
    });

    // Create internship
    const internship = await prisma.internship.create({
      data: {
        studentId,
        companyId: company.id,
        termId: parseInt(termId),
        status: 'IN_PROGRESS',
        internshipOrder: internshipType,
        durationDays: parseInt(duration) || 20,
        isErasmus: isErasmus === true || isErasmus === 'true',
        companyContactName: contactName || null,
        companyContactPosition: contactPosition || null,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        grade: null, // Ungraded by default
        gradeComment: null,
        reportUrl: reportUrl || null,
        documentUrl: documentUrl || null,
        ...(req.file ? { originalDocument: { create: { name: req.file.originalname, data: req.file.buffer } } } : {})
      },
      include: {
        student: true,
        company: true,
        term: true
      }
    });

    console.log('Internship created successfully:', internship.id);

    return res.json({
      success: true,
      message: 'Internship created successfully',
      internship
    });

  } catch (error) {
    console.error('Error creating internship:', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ 
        error: 'Duplicate entry: Student already has this internship type registered' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to create internship',
      details: error.message 
    });
  }
}

/**
 * Get all internships (with filters)
 * GET /api/internships?studentId=...&termId=...&departmentId=...
 */
export async function getInternships(req, res) {
  try {
    const { studentId, termId, departmentId, internshipType, status } = req.query;

    const account = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { role: true } });
    const effectiveDepartment = account?.role?.name === 'General Admin' ? departmentId : account?.departmentId;
    if (!await departmentAccess(req, res, effectiveDepartment)) return;
    const where = {};
    
    if (studentId) where.studentId = studentId;
    if (termId) where.termId = parseInt(termId);
    if (internshipType) where.internshipOrder = internshipType;
    if (status) where.status = status;
    if (effectiveDepartment) {
      where.student = {
        departmentId: parseInt(effectiveDepartment)
      };
    }

    const internships = await prisma.internship.findMany({
      where,
      include: {
        student: {
          include: {
            department: true
          }
        },
        company: true,
        term: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.json(internships);
  } catch (error) {
    console.error('Error fetching internships:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch internships' 
    });
  }
}

/**
 * Update internship
 * PUT /api/internship/:id
 */
export async function updateInternship(req, res) {
  try {
    const { id } = req.params;
    const target = await prisma.internship.findUnique({ where: { id: Number(id) }, include: { student: true } });
    if (!target) return res.status(404).json({ error: 'Internship not found' });
    if (!await departmentAccess(req, res, target.student.departmentId)) return;

    // Allow only form corrections; ownership, relations, and grades use separate workflows.
    const allowed = ['startDate', 'endDate', 'durationDays', 'companyContactName', 'companyContactPosition', 'isErasmus'];
    const updateData = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const start = updateData.startDate ? parseDate(updateData.startDate) : target.startDate;
    const end = updateData.endDate ? parseDate(updateData.endDate) : target.endDate;
    if (!start || !end || end < start ||
        (updateData.durationDays !== undefined && (!Number.isInteger(updateData.durationDays) || updateData.durationDays <= 0))) {
      return res.status(400).json({ error: 'Geçerli tarih ve süre giriniz.' });
    }
    if (updateData.startDate) updateData.startDate = start;
    if (updateData.endDate) updateData.endDate = end;
    if (req.body.companyName !== undefined) {
      const name = req.body.companyName?.trim();
      if (!name || name.toUpperCase() === 'NOT FOUND') return res.status(400).json({ error: 'Kurum adı zorunludur.' });
      const company = await prisma.company.upsert({ where: { name }, update: {}, create: { name } });
      updateData.companyId = company.id;
    }

    const internship = await prisma.internship.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        student: true,
        company: true,
        term: true
      }
    });

    return res.json({
      success: true,
      message: 'Internship updated successfully',
      internship
    });
  } catch (error) {
    console.error('Error updating internship:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Internship not found' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to update internship' 
    });
  }
}

/**
 * Delete internship
 * DELETE /api/internship/:id
 */
export async function deleteInternship(req, res) {
  try {
    const { id } = req.params;

    const target = await prisma.internship.findUnique({ where: { id: Number(id) }, include: { student: true } });
    if (!target) return res.status(404).json({ error: 'Internship not found' });
    if (!await departmentAccess(req, res, target.student.departmentId)) return;

    await prisma.internship.delete({
      where: { id: parseInt(id) }
    });

    return res.json({
      success: true,
      message: 'Internship deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting internship:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Internship not found' });
    }
    
    return res.status(500).json({ 
      error: 'Failed to delete internship' 
    });
  }
}

// ========== HELPER FUNCTIONS ==========

/**
 * Parse internship PDF and extract data
 */
async function parseInternshipPdf(dataBuffer) {
  try {
    const data = await pdf(dataBuffer);
    const text = data.text.replace(/\s+/g, ' ');

    console.log("--- CLEAN TEXT PREVIEW ---");
    console.log(text.substring(0, 600) + "...");
    console.log("--------------------------");

    // Extract fields using regex patterns
    const nameMatch = text.match(/Adı Soyadı\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Öğrenci Numarası/i);
    const idMatch = text.match(/Öğrenci Numarası\s*[:,"]*\s*(\d+)/i);
    
    // Department extraction
    const departmentMatch = text.match(/Bölümü\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Sınıfı/i);
    
    // Student contact info
    const studentPhoneMatch = text.match(/Cep Telefon Numarası\s*[:,"]*\s*(\d+)/i);
    const studentEmailMatch = text.match(/Eposta Adresi[:\s"]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    
    // Company info
    const companyMatch = text.match(/Kurum\/Kuruluş Adı\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Temas/i);
    const contactMatch = text.match(/Temas Kuracağı Kişinin Adı Soyadı\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Görevi/i);
    const positionMatch = text.match(/Görevi\s*\/\s*Pozisyonu\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Kurum\/Kuruluşun Telefon/i);
    const companyPhoneMatch = text.match(/Kurum\/Kuruluşun Telefon Numarası\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Kurum\/Kuruluşun Eposta/i);
    const companyEmailMatch = text.match(/Kurum\/Kuruluşun Eposta Adresi\s*[:,"]*\s*(.*?)\s*[:,"]*\s*Kurum\/Kuruluşun Adresi/i);
    
    // Dates and duration - flexible to handle single or double digit days/months
    const startMatch = text.match(/Başlangıç Tarihi[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    const endMatch = text.match(/Bitiş Tarihi[:\s]*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    const durationMatch = text.match(/Süresi[:\s]*(\d+)/i);
    const typeMatch = text.match(/(STAJ\s*\d+)/i);

    // Debug logging for dates
    console.log("Date extraction debug:");
    console.log("Start date match:", startMatch ? startMatch[1] : "NOT FOUND");
    console.log("End date match:", endMatch ? endMatch[1] : "NOT FOUND");
    
    // Try alternative patterns if dates not found
    let startDate = startMatch ? startMatch[1] : null;
    let endDate = endMatch ? endMatch[1] : null;
    
    if (!startDate) {
      // Try alternative pattern with more flexible spacing
      const altStartMatch = text.match(/Başlangıç[:\s,]*Tarihi[:\s,]*(\d{2}\.\d{2}\.\d{4})/i);
      if (altStartMatch) {
        startDate = altStartMatch[1];
        console.log("Found start date with alternative pattern:", startDate);
      }
    }
    
    if (!endDate) {
      // Try alternative pattern with more flexible spacing
      const altEndMatch = text.match(/Bitiş[:\s,]*Tarihi[:\s,]*(\d{2}\.\d{2}\.\d{4})/i);
      if (altEndMatch) {
        endDate = altEndMatch[1];
        console.log("Found end date with alternative pattern:", endDate);
      }
    }

    const clean = (str) => {
      if (!str) return "NOT FOUND";
      return str.replace(/["",]/g, '').trim();
    };

    return {
      studentName: nameMatch ? clean(nameMatch[1]) : "NOT FOUND",
      studentId: idMatch ? clean(idMatch[1]) : "NOT FOUND",
      studentDepartment: departmentMatch ? clean(departmentMatch[1]) : "NOT FOUND",
      studentPhone: studentPhoneMatch ? clean(studentPhoneMatch[1]) : "NOT FOUND",
      studentEmail: studentEmailMatch ? clean(studentEmailMatch[1]) : "NOT FOUND",
      companyName: companyMatch ? clean(companyMatch[1]) : "NOT FOUND",
      companyPhone: companyPhoneMatch ? clean(companyPhoneMatch[1]) : "NOT FOUND",
      companyEmail: companyEmailMatch ? clean(companyEmailMatch[1]) : "NOT FOUND",
      contactName: contactMatch ? clean(contactMatch[1]) : "NOT FOUND",
      contactPosition: positionMatch ? clean(positionMatch[1]) : "NOT FOUND",
      startDate: startDate,
      endDate: endDate,
      duration: durationMatch ? parseInt(durationMatch[1]) : 20,
      internshipType: typeMatch ? typeMatch[1].replace(/\s/, '') : "STAJ1"
    };
  } catch (err) {
    console.error("PARSING ERROR:", err);
    throw new Error("Failed to parse PDF text.");
  }
}

/**
 * Convert DD.MM.YYYY to ISO Date
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // If already ISO format
  if (dateStr.includes('-')) {
    return new Date(dateStr);
  }
  
  // Parse DD.MM.YYYY
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  
  return new Date(year, month - 1, day);
}

/**
 * Generate commission evaluation report
 * POST /api/internship/generate-report
 * Body: { termId, departmentId, gradeFilter, studentTypeFilter, studentIds? }
 */
export async function generateCommissionReport(req, res) {
  try {
    const { termId, departmentId, gradeFilter, studentTypeFilter, studentIds } = req.body;

    if (!termId || !departmentId) {
      return res.status(400).json({ error: 'Term ID ve Department ID gereklidir.' });
    }

    // Fetch term info
    const term = await prisma.term.findUnique({
      where: { id: parseInt(termId) }
    });

    if (!term) {
      return res.status(404).json({ error: 'Dönem bulunamadı.' });
    }

    // Fetch department info
    const department = await prisma.department.findUnique({
      where: { id: parseInt(departmentId) }
    });

    if (!department) {
      return res.status(404).json({ error: 'Bölüm bulunamadı.' });
    }

    if (!await departmentAccess(req, res, departmentId)) return;

    // Build filters for internships
    const whereClause = {
      termId: parseInt(termId),
      isReported: false, // Only include internships that haven't been reported yet
      student: {
        departmentId: parseInt(departmentId)
      }
    };

    // If specific student IDs are provided, filter by them
    if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
      whereClause.student.id = {
        in: studentIds
      };
    }

    // Apply grade filter
    if (gradeFilter && gradeFilter !== 'all') {
      if (gradeFilter === 'ungraded') {
        whereClause.grade = null;
      } else {
        whereClause.grade = gradeFilter;
      }
    }

    // Apply student type filter
    if (studentTypeFilter && studentTypeFilter !== 'all') {
      whereClause.internshipOrder = studentTypeFilter === 'first' ? 'STAJ1' : 'STAJ2';
    }

    // Fetch internships with student and company info
    const internships = await prisma.internship.findMany({
      where: whereClause,
      include: {
        student: true,
        company: true
      },
      orderBy: {
        studentId: 'asc'
      }
    });

    // Check if there are any internships to report
    if (internships.length === 0) {
      return res.status(404).json({ 
        error: 'Raporlanacak staj bulunamadı. Tüm stajlar zaten raporlanmış olabilir.' 
      });
    }

    // Fetch commission chair and members for this department
    const commissionChair = await prisma.user.findFirst({
      where: {
        departmentId: parseInt(departmentId),
        role: {
          name: 'Commission Chair'
        }
      },
      select: {
        name: true
      }
    });

    const commissionMembers = await prisma.user.findMany({
      where: {
        departmentId: parseInt(departmentId),
        role: {
          name: 'Commission Member'
        }
      },
      select: {
        name: true
      }
    });

    // Generate Word document
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'GEBZE TEKNİK ÜNİVERSİTESİ',
                bold: true,
                size: 28,
              })
            ]
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'KOMİSYON DEĞERLENDİRME TUTANAĞI',
                bold: true,
                size: 24,
              })
            ]
          }),

          // Creation date and term info
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Oluşturma Tarihi: `,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: new Date().toLocaleDateString('tr-TR'),
                size: 22,
              })
            ]
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: `Dönem: `,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: term.name,
                size: 22,
              })
            ]
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: `Bölüm: `,
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: department.name,
                size: 22,
              })
            ]
          }),

          // Commission members
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: 'Komisyon Başkanı: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: commissionChair?.name || 'Belirtilmemiş',
                size: 22,
              })
            ]
          }),
          new Paragraph({
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: 'Komisyon Üyeleri: ',
                bold: true,
                size: 22,
              }),
              new TextRun({
                text: commissionMembers.length > 0 
                  ? commissionMembers.map(m => m.name).join(', ')
                  : 'Belirtilmemiş',
                size: 22,
              })
            ]
          }),

          // Table with internship data
          new Table({
            width: {
              size: 100,
              type: WidthType.PERCENTAGE,
            },
            rows: [
              // Header row
              new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Öğrenci No', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Ad Soyad', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Staj Türü', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Staj Yeri', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Başlangıç Tarihi', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Bitiş Tarihi', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                  new TableCell({
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Not', bold: true })] })],
                    shading: { fill: 'CCCCCC' }
                  }),
                ]
              }),
              // Data rows
              ...internships.map(internship => new TableRow({
                children: [
                  new TableCell({
                    children: [new Paragraph({ text: internship.student.id, alignment: AlignmentType.CENTER })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: internship.student.name })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: internship.internshipOrder === 'STAJ1' ? 'Staj 1' : 'Staj 2', alignment: AlignmentType.CENTER })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: internship.company.name })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: new Date(internship.startDate).toLocaleDateString('tr-TR'), alignment: AlignmentType.CENTER })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: new Date(internship.endDate).toLocaleDateString('tr-TR'), alignment: AlignmentType.CENTER })]
                  }),
                  new TableCell({
                    children: [new Paragraph({ text: internship.grade || '-', alignment: AlignmentType.CENTER })]
                  }),
                ]
              }))
            ]
          }),

          // Footer space for signatures
          new Paragraph({
            text: '',
            spacing: { before: 800, after: 400 }
          }),
          new Paragraph({
            text: '___________________________',
            spacing: { after: 100 }
          }),
          new Paragraph({
            text: 'Komisyon Başkanı İmzası',
            alignment: AlignmentType.LEFT,
            spacing: { after: 400 }
          }),
        ]
      }]
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Mark all internships as reported
    await prisma.internship.updateMany({
      where: whereClause,
      data: {
        isReported: true
      }
    });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename=Komisyon_Degerlendirme_Tutanagi_${term.name.replace(/\s/g, '_')}.docx`);
    res.send(buffer);

  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ 
      error: 'Rapor oluşturulurken hata oluştu', 
      details: error.message 
    });
  }
}

export async function getOriginalDocument(req, res) {
  try {
    const internship = await prisma.internship.findUnique({
      where: { id: Number(req.params.id) }, include: { student: true }
    });
    if (!internship) return res.status(404).json({ error: 'Staj bulunamadı.' });
    if (!await departmentAccess(req, res, internship.student.departmentId)) return;
    const document = await prisma.internshipDocument.findUnique({ where: { internshipId: internship.id } });
    if (!document) return res.status(404).json({ error: 'Bu kayıt için orijinal PDF saklanmamış.' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="staj.pdf"; filename*=UTF-8''${encodeURIComponent(document.name)}`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(Buffer.from(document.data));
  } catch (error) {
    return res.status(500).json({ error: 'Belge indirilemedi.' });
  }
}
