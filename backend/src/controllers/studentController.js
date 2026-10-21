import { departmentAccess } from '../utils/departmentAccess.js';
import prisma from '../config/prisma.js';

// Get all terms
export const getAllTerms = async (req, res) => {
    try {
        const terms = await prisma.term.findMany({
            select: {
                id: true,
                name: true,
                startDate: true,
                endDate: true
            },
            orderBy: {
                startDate: 'desc'
            }
        });
        res.json(terms);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Dönemler getirilirken bir hata oluştu.' });
    }
};

// Get students with internships for a specific department and term
export const getStudentsByDepartmentAndTerm = async (req, res) => {
    try {
        const { departmentId, termId } = req.params;
        const { gradeFilter, studentTypeFilter } = req.query;

        if (!await departmentAccess(req, res, departmentId)) return;

        // Build where clause for internship filtering
        let internshipWhere = {
            termId: parseInt(termId)
        };

        // Apply grade filter if provided
        if (gradeFilter && gradeFilter !== 'all') {
            if (gradeFilter === 'ungraded') {
                internshipWhere.grade = null;
            } else if (gradeFilter === 'S' || gradeFilter === 'U') {
                internshipWhere.grade = gradeFilter;
            }
        }

        // Get students with their internships
        const students = await prisma.student.findMany({
            where: {
                departmentId: parseInt(departmentId),
                internships: {
                    some: internshipWhere
                }
            },
            include: {
                internships: {
                    where: internshipWhere, // Apply the same filter here too
                    include: {
                        company: {
                            select: {
                                name: true
                            }
                        },
                        term: {
                            select: {
                                name: true,
                                startDate: true,
                                endDate: true
                            }
                        }
                    }
                }
            }
        });

        // Get previous internships for each student (STAJ1 if current is STAJ2)
        // and create a row for EACH internship the student has in this term
        const enrichedStudents = [];
        
        for (const student of students) {
            // Filter to get only the internships that match our criteria
            const matchingInternships = student.internships.filter(internship => {
                let matches = internship.termId === parseInt(termId);
                
                // Apply grade filter
                if (gradeFilter && gradeFilter !== 'all') {
                    if (gradeFilter === 'ungraded') {
                        matches = matches && internship.grade === null;
                    } else if (gradeFilter === 'S' || gradeFilter === 'U') {
                        matches = matches && internship.grade === gradeFilter;
                    }
                }
                
                return matches;
            });
            
            // Create a separate entry for EACH matching internship
            for (const currentInternship of matchingInternships) {
                // If this is STAJ2, fetch the STAJ1
                let previousInternship = null;
                if (currentInternship?.internshipOrder === 'STAJ2') {
                    previousInternship = await prisma.internship.findFirst({
                        where: {
                            studentId: student.id,
                            internshipOrder: 'STAJ1'
                        },
                        include: {
                            company: {
                                select: {
                                    name: true
                                }
                            }
                        }
                    });
                }

                enrichedStudents.push({
                    id: student.id,
                    studentNumber: student.id,
                    name: student.name,
                    email: student.email,
                    phone_number: student.phone_number,
                    currentInternship: {
                        id: currentInternship.id,
                        company: currentInternship.company.name,
                        startDate: currentInternship.startDate,
                        endDate: currentInternship.endDate,
                        grade: currentInternship.grade,
                        gradeComment: currentInternship.gradeComment,
                        internshipOrder: currentInternship.internshipOrder,
                        status: currentInternship.status,
                        durationDays: currentInternship.durationDays,
                        isErasmus: currentInternship.isErasmus,
                        reportUrl: currentInternship.reportUrl,
                        documentUrl: currentInternship.documentUrl
                    },
                    previousInternship: previousInternship ? {
                        id: previousInternship.id,
                        company: previousInternship.company.name,
                        grade: previousInternship.grade,
                        internshipOrder: previousInternship.internshipOrder
                    } : null
                });
            }
        }

        // Apply student type filter
        let filteredStudents = enrichedStudents;
        
        if (studentTypeFilter && studentTypeFilter !== 'all') {
            if (studentTypeFilter === 'first') {
                filteredStudents = enrichedStudents.filter(s => 
                    s.currentInternship?.internshipOrder === 'STAJ1'
                );
            } else if (studentTypeFilter === 'second') {
                filteredStudents = enrichedStudents.filter(s => 
                    s.currentInternship?.internshipOrder === 'STAJ2'
                );
            }
        }

        res.json(filteredStudents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Öğrenciler getirilirken bir hata oluştu.' });
    }
};

// Get single student details with all internships
export const getStudentDetails = async (req, res) => {
    try {
        const { studentId } = req.params;

        const student = await prisma.student.findUnique({
            where: {
                id: studentId
            },
            include: {
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                internships: {
                    include: {
                        company: true,
                        term: true
                    },
                    orderBy: {
                        createdAt: 'desc'
                    }
                }
            }
        });

        if (!student) {
            return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
        }

        if (!await departmentAccess(req, res, student.departmentId)) return;
        res.json(student);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Öğrenci bilgileri getirilirken bir hata oluştu.' });
    }
};

// Create or update student
export const upsertStudent = async (req, res) => {
    try {
        const { id, name, email, phone_number, departmentId } = req.body;

        if (!id || !name || !email || !departmentId) {
            return res.status(400).json({ error: 'Gerekli alanlar eksik.' });
        }

        if (!await departmentAccess(req, res, departmentId)) return;
        const existing = await prisma.student.findUnique({ where: { id } });
        if (existing && !await departmentAccess(req, res, existing.departmentId)) return;
        const student = await prisma.student.upsert({
            where: { id },
            update: {
                name,
                email,
                phone_number,
                departmentId: parseInt(departmentId)
            },
            create: {
                id,
                name,
                email,
                phone_number,
                departmentId: parseInt(departmentId)
            },
            include: {
                department: true
            }
        });

        res.json({
            message: 'Öğrenci başarıyla kaydedildi.',
            student
        });
    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Bu öğrenci numarası veya e-posta zaten kullanılıyor.' });
        }
        res.status(500).json({ error: 'Öğrenci kaydedilirken bir hata oluştu.' });
    }
};
