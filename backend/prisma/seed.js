import {
  PrismaClient,
  InternshipStatus,
  InternshipOrderType,
} from '@prisma/client';

const prisma = new PrismaClient();

// A pre-hashed password for 'password123' (using bcrypt, cost 10)
// This is best practice so you don't store plain text.
const HASHED_PASSWORD =
  '$2b$10$vOqam42NDF7.qk7lcv8Hpe51Wwv9Atp/yM65eRT5fGMtSGtmtxjZe';

async function main() {
  console.log(`Start seeding ...`);

  // 1. Roles
  console.log('Seeding Roles...');
  const roleAdmin = await prisma.role.upsert({
    where: { name: 'General Admin' },
    update: {},
    create: { name: 'General Admin' },
  });
  const roleChair = await prisma.role.upsert({
    where: { name: 'Commission Chair' },
    update: {},
    create: { name: 'Commission Chair' },
  });
  const roleMember = await prisma.role.upsert({
    where: { name: 'Commission Member' },
    update: {},
    create: { name: 'Commission Member' },
  });

  // 3. Departments (Seeding before Users/Students)
console.log('Seeding Departments...');

const bilgisayarMuh = await prisma.department.upsert({
  where: { name: 'Bilgisayar Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Bilgisayar Mühendisliği (İngilizce)' },
});

const biyomuh = await prisma.department.upsert({
  where: { name: 'Biyomühendislik (İngilizce)' },
  update: {},
  create: { name: 'Biyomühendislik (İngilizce)' },
});

const cevreMuh = await prisma.department.upsert({
  where: { name: 'Çevre Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Çevre Mühendisliği (İngilizce)' },
});

const elektronikMuh = await prisma.department.upsert({
  where: { name: 'Elektronik Mühendisliği' },
  update: {},
  create: { name: 'Elektronik Mühendisliği' },
});

const endustriMuh = await prisma.department.upsert({
  where: { name: 'Endüstri Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Endüstri Mühendisliği (İngilizce)' },
});

const endustriselTasarim = await prisma.department.upsert({
  where: { name: 'Endüstriyel Tasarım' },
  update: {},
  create: { name: 'Endüstriyel Tasarım' },
});

const fizik = await prisma.department.upsert({
  where: { name: 'Fizik (İngilizce)' },
  update: {},
  create: { name: 'Fizik (İngilizce)' },
});

const haritaMuh = await prisma.department.upsert({
  where: { name: 'Harita Mühendisliği' },
  update: {},
  create: { name: 'Harita Mühendisliği' },
});

const iktisat = await prisma.department.upsert({
  where: { name: 'İktisat' },
  update: {},
  create: { name: 'İktisat' },
});

const insaatMuh = await prisma.department.upsert({
  where: { name: 'İnşaat Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'İnşaat Mühendisliği (İngilizce)' },
});

const isletme = await prisma.department.upsert({
  where: { name: 'İşletme' },
  update: {},
  create: { name: 'İşletme' },
});

const kimya = await prisma.department.upsert({
  where: { name: 'Kimya (İngilizce)' },
  update: {},
  create: { name: 'Kimya (İngilizce)' },
});

const kimyaMuh = await prisma.department.upsert({
  where: { name: 'Kimya Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Kimya Mühendisliği (İngilizce)' },
});

const makineMuh = await prisma.department.upsert({
  where: { name: 'Makine Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Makine Mühendisliği (İngilizce)' },
});

const malzemeBilimi = await prisma.department.upsert({
  where: { name: 'Malzeme Bilimi ve Mühendisliği' },
  update: {},
  create: { name: 'Malzeme Bilimi ve Mühendisliği' },
});

const matematik = await prisma.department.upsert({
  where: { name: 'Matematik (İngilizce)' },
  update: {},
  create: { name: 'Matematik (İngilizce)' },
});

const mimarlik = await prisma.department.upsert({
  where: { name: 'Mimarlık' },
  update: {},
  create: { name: 'Mimarlık' },
});

const molekulerBiyoloji = await prisma.department.upsert({
  where: { name: 'Moleküler Biyoloji ve Genetik (İngilizce)' },
  update: {},
  create: { name: 'Moleküler Biyoloji ve Genetik (İngilizce)' },
});

const sehirPlanlama = await prisma.department.upsert({
  where: { name: 'Şehir ve Bölge Planlama' },
  update: {},
  create: { name: 'Şehir ve Bölge Planlama' },
});

const ucakMuh = await prisma.department.upsert({
  where: { name: 'Uçak Mühendisliği (İngilizce)' },
  update: {},
  create: { name: 'Uçak Mühendisliği (İngilizce)' },
});

const veriBilimi = await prisma.department.upsert({
  where: { name: 'Veri Bilimi ve Analitiği (İngilizce)' },
  update: {},
  create: { name: 'Veri Bilimi ve Analitiği (İngilizce)' },
});

const yonetimBilisim = await prisma.department.upsert({
  where: { name: 'Yönetim Bilişim Sistemleri (İngilizce)' },
  update: {},
  create: { name: 'Yönetim Bilişim Sistemleri (İngilizce)' },
});

  // 2. Users
  console.log('Seeding Users...');
  // General Admins
  await prisma.user.upsert({
    where: { username: 'admin1' },
    update: {},
    create: {
      name: 'Admin User',
      username: 'admin1',
      email: 'admin1@example.com',
      password: HASHED_PASSWORD,
      roleId: roleAdmin.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'admin2' },
    update: {},
    create: {
      name: 'Admin Two',
      username: 'admin2',
      email: 'admin2@example.com',
      password: HASHED_PASSWORD,
      roleId: roleAdmin.id,
    },
  });

  // Computer Engineering Staff
  await prisma.user.upsert({
    where: { username: 'ceng_chair' },
    update: {},
    create: {
      name: 'Ahmet Yılmaz',
      username: 'ceng_chair',
      email: 'ceng_chair@example.com',
      password: HASHED_PASSWORD,
      roleId: roleChair.id,
      departmentId: bilgisayarMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'ceng_member1' },
    update: {},
    create: {
      name: 'Mehmet Kaya',
      username: 'ceng_member1',
      email: 'ceng_member1@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: bilgisayarMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'ceng_member2' },
    update: {},
    create: {
      name: 'Ayşe Demir',
      username: 'ceng_member2',
      email: 'ceng_member2@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: bilgisayarMuh.id,
    },
  });

  // Electrical Engineering Staff
  await prisma.user.upsert({
    where: { username: 'eeng_chair' },
    update: {},
    create: {
      name: 'Fatma Öztürk',
      username: 'eeng_chair',
      email: 'eeng_chair@example.com',
      password: HASHED_PASSWORD,
      roleId: roleChair.id,
      departmentId: elektronikMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'eeng_member1' },
    update: {},
    create: {
      name: 'Can Arslan',
      username: 'eeng_member1',
      email: 'eeng_member1@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: elektronikMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'eeng_member2' },
    update: {},
    create: {
      name: 'Zeynep Çelik',
      username: 'eeng_member2',
      email: 'eeng_member2@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: elektronikMuh.id,
    },
  });

  // Mechanical Engineering Staff
  await prisma.user.upsert({
    where: { username: 'meng_chair' },
    update: {},
    create: {
      name: 'Burak Şahin',
      username: 'meng_chair',
      email: 'meng_chair@example.com',
      password: HASHED_PASSWORD,
      roleId: roleChair.id,
      departmentId: makineMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'meng_member1' },
    update: {},
    create: {
      name: 'Elif Yıldız',
      username: 'meng_member1',
      email: 'meng_member1@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: makineMuh.id,
    },
  });
  await prisma.user.upsert({
    where: { username: 'meng_member2' },
    update: {},
    create: {
      name: 'Emre Aydın',
      username: 'meng_member2',
      email: 'meng_member2@example.com',
      password: HASHED_PASSWORD,
      roleId: roleMember.id,
      departmentId: makineMuh.id,
    },
  });

 // 4. Students
console.log('Seeding Students...');
// CENG Students (4)
const s1 = await prisma.student.upsert({
  where: { id: '220104004001' },
  update: {},
  create: {
    id: '220104004001',
    name: 'Ali Veli',
    email: 'ali.veli@example.com',
    phone_number: '555-101-0001',
    departmentId: bilgisayarMuh.id,
  },
});
const s2 = await prisma.student.upsert({
  where: { id: '220104004002' },
  update: {},
  create: {
    id: '220104004002',
    name: 'Ayşe Kaya',
    email: 'ayse.kaya@example.com',
    phone_number: '555-101-0002',
    departmentId: bilgisayarMuh.id,
  },
});
const s3 = await prisma.student.upsert({
  where: { id: '220104004003' },
  update: {},
  create: {
    id: '220104004003',
    name: 'Mehmet Yılmaz',
    email: 'mehmet.yilmaz@example.com',
    phone_number: '555-101-0003',
    departmentId: bilgisayarMuh.id,
  },
});
const s4 = await prisma.student.upsert({
  where: { id: '220104004004' },
  update: {},
  create: {
    id: '220104004004',
    name: 'Fatma Demir',
    email: 'fatma.demir@example.com',
    phone_number: '555-101-0004',
    departmentId: bilgisayarMuh.id,
  },
});

// EENG Students (4)
const s5 = await prisma.student.upsert({
  where: { id: '220105001001' },
  update: {},
  create: {
    id: '220105001001',
    name: 'Hasan Çelik',
    email: 'hasan.celik@example.com',
    phone_number: '555-102-0001',
    departmentId: elektronikMuh.id,
  },
});
const s6 = await prisma.student.upsert({
  where: { id: '220105001002' },
  update: {},
  create: {
    id: '220105001002',
    name: 'Zeynep Şahin',
    email: 'zeynep.sahin@example.com',
    phone_number: '555-102-0002',
    departmentId: elektronikMuh.id,
  },
});
const s7 = await prisma.student.upsert({
  where: { id: '220105001003' },
  update: {},
  create: {
    id: '220105001003',
    name: 'Burak Öz',
    email: 'burak.oz@example.com',
    phone_number: '555-102-0003',
    departmentId: elektronikMuh.id,
  },
});
const s8 = await prisma.student.upsert({
  where: { id: '220105001004' },
  update: {},
  create: {
    id: '220105001004',
    name: 'Elif Arda',
    email: 'elif.arda@example.com',
    phone_number: '555-102-0004',
    departmentId: elektronikMuh.id,
  },
});

// MENG Students (4)
const s9 = await prisma.student.upsert({
  where: { id: '220106002001' },
  update: {},
  create: {
    id: '220106002001',
    name: 'Kemal Can',
    email: 'kemal.can@example.com',
    phone_number: '555-103-0001',
    departmentId: makineMuh.id,
  },
});
const s10 = await prisma.student.upsert({
  where: { id: '220106002002' },
  update: {},
  create: {
    id: '220106002002',
    name: 'Derya Güneş',
    email: 'derya.gunes@example.com',
    phone_number: '555-103-0002',
    departmentId: makineMuh.id,
  },
});
const s11 = await prisma.student.upsert({
  where: { id: '220106002003' },
  update: {},
  create: {
    id: '220106002003',
    name: 'Ömer Faruk',
    email: 'omer.faruk@example.com',
    phone_number: '555-103-0003',
    departmentId: makineMuh.id,
  },
});
const s12 = await prisma.student.upsert({
  where: { id: '220106002004' },
  update: {},
  create: {
    id: '220106002004',
    name: 'İpek Yıldız',
    email: 'ipek.yildiz@example.com',
    phone_number: '555-103-0004',
    departmentId: makineMuh.id,
  },
});


  // 5. Terms
  console.log('Seeding Terms...');
  const termSummer25 = await prisma.term.upsert({
    where: { name: '2025 Summer Internship Term' },
    update: {},
    create: {
      name: '2025 Summer Internship Term',
      startDate: new Date('2025-06-01T00:00:00Z'),
      endDate: new Date('2025-09-01T00:00:00Z'),
    },
  });
  const termWinter25 = await prisma.term.upsert({
    where: { name: '2025 Winter Internship Term' },
    update: {},
    create: {
      name: '2025 Winter Internship Term',
      startDate: new Date('2025-01-01T00:00:00Z'),
      endDate: new Date('2025-02-28T00:00:00Z'),
    },
  });

  // 6. Companies
  console.log('Seeding Companies...');
  const aselsan = await prisma.company.upsert({
    where: { name: 'ASELSAN' },
    update: {},
    create: {
      name: 'ASELSAN',
      phone: '0312-000-0001',
      email: 'info@aselsan.com',
    },
  });
  const roketsan = await prisma.company.upsert({
    where: { name: 'ROKETSAN' },
    update: {},
    create: {
      name: 'ROKETSAN',
      phone: '0312-000-0002',
      email: 'info@roketsan.com',
    },
  });
  const havelsan = await prisma.company.upsert({
    where: { name: 'HAVELSAN' },
    update: {},
    create: {
      name: 'HAVELSAN',
      phone: '0312-000-0003',
      email: 'info@havelsan.com',
    },
  });
  const turkTelekom = await prisma.company.upsert({
    where: { name: 'TÜRK TELEKOM' },
    update: {},
    create: {
      name: 'TÜRK TELEKOM',
      phone: '0212-000-0004',
      email: 'info@turktelekom.com',
    },
  });
  const turkcell = await prisma.company.upsert({
    where: { name: 'TURKCELL' },
    update: {},
    create: {
      name: 'TURKCELL',
      phone: '0212-000-0005',
      email: 'info@turkcell.com',
    },
  });
  const garanti = await prisma.company.upsert({
    where: { name: 'GARANTİ BBVA' },
    update: {},
    create: {
      name: 'GARANTİ BBVA',
      phone: '0212-000-0006',
      email: 'info@garanti.com',
    },
  });
  const isBankasi = await prisma.company.upsert({
    where: { name: 'İŞ BANKASI' },
    update: {},
    create: {
      name: 'İŞ BANKASI',
      phone: '0212-000-0007',
      email: 'info@isbank.com',
    },
  });

  // 7. Internships
  console.log('Seeding Internships...');

  // Student 1 (Ali Veli) - STAJ1 (Completed) & STAJ2 (In Progress)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s1.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s1.id,
      companyId: aselsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-06-15T00:00:00Z'),
      endDate: new Date('2025-07-15T00:00:00Z'),
      grade: 'S', // Satisfactory
      gradeComment: 'Excellent performance. Demonstrated strong technical skills and professionalism.',
      reportUrl: 'https://example.com/reports/s1_staj1.pdf',
      documentUrl: 'https://example.com/docs/s1_staj1.pdf',
      companyContactName: 'Ahmet Yılmaz',
      companyContactPosition: 'Senior Engineer',
    },
  });
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s1.id,
        internshipOrder: InternshipOrderType.STAJ2,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s1.id,
      companyId: roketsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.IN_PROGRESS,
      internshipOrder: InternshipOrderType.STAJ2,
      durationDays: 20,
      startDate: new Date('2025-07-20T00:00:00Z'),
      endDate: new Date('2025-08-20T00:00:00Z'),
      companyContactName: 'Elif Demir',
      companyContactPosition: 'HR Manager',
    },
  });

  // Student 2 (Ayşe Kaya) - STAJ1 (Awaiting)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s2.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s2.id,
      companyId: havelsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.AWAITING_EVALUATION,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 25,
      startDate: new Date('2025-07-01T00:00:00Z'),
      endDate: new Date('2025-08-05T00:00:00Z'),
      reportUrl: 'https://example.com/reports/s2_staj1.pdf',
    },
  });

  // Student 3 (Mehmet Yılmaz) - STAJ1 (Completed, Winter)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s3.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termWinter25.id,
      },
    },
    update: {},
    create: {
      studentId: s3.id,
      companyId: turkTelekom.id,
      termId: termWinter25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-01-15T00:00:00Z'),
      endDate: new Date('2025-02-15T00:00:00Z'),
      grade: 'S',
      gradeComment: 'Good adaptation to corporate environment. Met all requirements.',
    },
  });

  // Student 4 (Fatma Demir) - STAJ1 (In Progress)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s4.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s4.id,
      companyId: turkcell.id,
      termId: termSummer25.id,
      status: InternshipStatus.IN_PROGRESS,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-08-01T00:00:00Z'),
      endDate: new Date('2025-08-29T00:00:00Z'),
    },
  });

  // Student 5 (Hasan Çelik) - STAJ1 (Completed)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s5.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s5.id,
      companyId: garanti.id,
      termId: termSummer25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-06-20T00:00:00Z'),
      endDate: new Date('2025-07-18T00:00:00Z'),
      grade: 'S',
      gradeComment: 'Performed well and showed initiative in assigned tasks.',
    },
  });

  // Student 6 (Zeynep Şahin) - STAJ1 (Awaiting) & STAJ2 (In Progress, Erasmus)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s6.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termWinter25.id,
      },
    },
    update: {},
    create: {
      studentId: s6.id,
      companyId: isBankasi.id,
      termId: termWinter25.id,
      status: InternshipStatus.AWAITING_EVALUATION,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-01-20T00:00:00Z'),
      endDate: new Date('2025-02-18T00:00:00Z'),
      reportUrl: 'https://example.com/reports/s6_staj1.pdf',
    },
  });
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s6.id,
        internshipOrder: InternshipOrderType.STAJ2,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s6.id,
      companyId: aselsan.id, // Can be same company
      termId: termSummer25.id,
      status: InternshipStatus.IN_PROGRESS,
      internshipOrder: InternshipOrderType.STAJ2,
      durationDays: 40,
      isErasmus: true,
      startDate: new Date('2025-07-01T00:00:00Z'),
      endDate: new Date('2025-08-26T00:00:00Z'),
    },
  });

  // Student 7 (Burak Öz) - STAJ1 (Completed)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s7.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s7.id,
      companyId: roketsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-07-07T00:00:00Z'),
      endDate: new Date('2025-08-01T00:00:00Z'),
      grade: 'S',
      gradeComment: 'Outstanding work ethic and collaboration skills.',
    },
  });

  // Student 8 (Elif Arda) - STAJ1 (In Progress, Winter)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s8.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termWinter25.id,
      },
    },
    update: {},
    create: {
      studentId: s8.id,
      companyId: turkcell.id,
      termId: termWinter25.id,
      status: InternshipStatus.IN_PROGRESS,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-01-13T00:00:00Z'),
      endDate: new Date('2025-02-07T00:00:00Z'),
    },
  });

  // Student 9 (Kemal Can) - STAJ1 (Completed)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s9.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s9.id,
      companyId: havelsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 30,
      startDate: new Date('2025-06-16T00:00:00Z'),
      endDate: new Date('2025-07-28T00:00:00Z'),
      grade: 'S',
      gradeComment: 'Solid performance throughout the internship period.',
    },
  });

  // Student 10 (Derya Güneş) - STAJ1 (Awaiting)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s10.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s10.id,
      companyId: aselsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.AWAITING_EVALUATION,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-08-04T00:00:00Z'),
      endDate: new Date('2025-08-29T00:00:00Z'),
      reportUrl: 'https://example.com/reports/s10_staj1.pdf',
    },
  });

  // Student 11 (Ömer Faruk) - STAJ1 (Completed) & STAJ2 (Awaiting)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s11.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termWinter25.id,
      },
    },
    update: {},
    create: {
      studentId: s11.id,
      companyId: garanti.id,
      termId: termWinter25.id,
      status: InternshipStatus.COMPLETED,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-01-20T00:00:00Z'),
      endDate: new Date('2025-02-14T00:00:00Z'),
      grade: 'S',
      gradeComment: 'Meets all expectations. Ready for advanced internship.',
    },
  });
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s11.id,
        internshipOrder: InternshipOrderType.STAJ2,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s11.id,
      companyId: roketsan.id,
      termId: termSummer25.id,
      status: InternshipStatus.AWAITING_EVALUATION,
      internshipOrder: InternshipOrderType.STAJ2,
      durationDays: 20,
      startDate: new Date('2025-07-21T00:00:00Z'),
      endDate: new Date('2025-08-15T00:00:00Z'),
      reportUrl: 'https://example.com/reports/s11_staj2.pdf',
    },
  });

  // Student 12 (İpek Yıldız) - STAJ1 (In Progress)
  await prisma.internship.upsert({
    where: {
      studentId_internshipOrder_termId: {
        studentId: s12.id,
        internshipOrder: InternshipOrderType.STAJ1,
        termId: termSummer25.id,
      },
    },
    update: {},
    create: {
      studentId: s12.id,
      companyId: turkTelekom.id,
      termId: termSummer25.id,
      status: InternshipStatus.IN_PROGRESS,
      internshipOrder: InternshipOrderType.STAJ1,
      durationDays: 20,
      startDate: new Date('2025-08-11T00:00:00Z'),
      endDate: new Date('2025-09-05T00:00:00Z'),
    },
  });

  console.log(`Seeding finished.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
