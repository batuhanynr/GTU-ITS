import bcrypt from 'bcryptjs';
import prisma from '../config/prisma.js';

export const getAllDepartments = async (req, res) => {
    try {
        const departments = await prisma.department.findMany({
            select: {
                id: true,
                name: true
            }
        });
        res.json(departments);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Bölümler getirilirken bir hata oluştu.' });
    }
};

export const getDepartmentChair = async (req, res) => {
    try {
        const departmentId = parseInt(req.params.departmentId);

        // Find Commission Chair role
        const chairRole = await prisma.role.findUnique({
            where: { name: 'Commission Chair' }
        });

        if (!chairRole) {
            return res.json(null);
        }

        // Find chair for this department
        const chair = await prisma.user.findFirst({
            where: {
                departmentId: departmentId,
                roleId: chairRole.id
            },
            select: {
                id: true,
                name: true,
                email: true
            }
        });

        res.json(chair);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Başkan getirilirken bir hata oluştu.' });
    }
};

export const createCommissionChair = async (req, res) => {
    try {
        const { departmentId, firstName, lastName, email, temporaryPassword } = req.body;

        if (!departmentId || !firstName || !lastName || !email || !temporaryPassword) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        // Find Commission Chair role
        const chairRole = await prisma.role.findUnique({
            where: { name: 'Commission Chair' }
        });

        if (!chairRole) {
            return res.status(404).json({ error: 'Commission Chair rolü bulunamadı.' });
        }

        // Create username from first and last name
        const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
        const fullName = `${firstName} ${lastName}`;
        
        // Hash temporary password
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        // Roll back the deletion if creating the replacement fails.
        const newChair = await prisma.$transaction(async tx => {
            const existingChair = await tx.user.findFirst({
                where: { departmentId, roleId: chairRole.id }
            });
            if (existingChair) {
                await tx.user.delete({ where: { id: existingChair.id } });
            }
            return tx.user.create({
                data: {
                    name: fullName,
                    username,
                    email,
                    password: hashedPassword,
                    roleId: chairRole.id,
                    departmentId,
                    requiresPasswordChange: true
                },
                select: { id: true, name: true, email: true, role: true, department: true }
            });
        }, { isolationLevel: 'Serializable' });

        res.json({
            message: 'Komisyon başkanı başarıyla oluşturuldu.',
            user: newChair
        });

    } catch (error) {
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' });
        }
        res.status(500).json({ error: 'Komisyon başkanı oluşturulurken bir hata oluştu.' });
    }
};

export const removeCommissionChair = async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        if (!Number.isInteger(userId) || userId < 1 || userId > 2147483647) {
            return res.status(404).json({ error: 'Komisyon başkanı bulunamadı.' });
        }

        // Apply the role condition to the deletion itself so another account type cannot be removed.
        const removed = await prisma.user.deleteMany({
            where: { id: userId, role: { name: 'Commission Chair' } }
        });
        if (removed.count !== 1) {
            return res.status(404).json({ error: 'Komisyon başkanı bulunamadı.' });
        }

        res.json({ message: 'Komisyon başkanı başarıyla kaldırıldı.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Komisyon başkanı kaldırılırken bir hata oluştu.' });
    }
};

export const getCommissionChairs = async (req, res) => {
    try {
        // Find the Commission Chair role
        const chairRole = await prisma.role.findUnique({
            where: { name: 'Commission Chair' }
        });

        if (!chairRole) {
            return res.status(404).json({ error: 'Commission Chair rolü bulunamadı.' });
        }

        // Get all users with Commission Chair role
        const chairs = await prisma.user.findMany({
            where: {
                roleId: chairRole.id
            },
            select: {
                id: true,
                username: true,
                email: true,
                department: {
                    select: {
                        id: true,
                        name: true
                    }
                }
            }
        });

        res.json(chairs);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Komisyon başkanları getirilirken bir hata oluştu.' });
    }
};

export const assignCommissionChair = async (req, res) => {
    try {
        const { userId, departmentId } = req.body;

        if (!userId || !departmentId) {
            return res.status(400).json({ error: 'Kullanıcı ID ve Bölüm ID gereklidir.' });
        }

        // Check occupancy and move the chair in one transaction to prevent competing assignments.
        const result = await prisma.$transaction(async tx => {
            const target = await tx.user.findUnique({ where: { id: userId }, include: { role: true } });
            if (!target || target.role?.name !== 'Commission Chair') {
                return { status: 404, error: 'Komisyon başkanı bulunamadı.' };
            }
            const existingChair = await tx.user.findFirst({
                where: { departmentId, roleId: target.roleId, id: { not: userId } }
            });
            if (existingChair) {
                return { status: 409, error: 'Bu bölümde zaten bir komisyon başkanı var.' };
            }
            const user = await tx.user.update({
                where: { id: userId },
                data: { departmentId },
                include: { role: true, department: true }
            });
            return { user };
        }, { isolationLevel: 'Serializable' });
        if (result.error) return res.status(result.status).json({ error: result.error });

        res.json({
            message: 'Komisyon başkanı başarıyla atandı.',
            user: result.user
        });

    } catch (error) {
        if (error.code === 'P2034') {
            return res.status(409).json({ error: 'Başkan ataması değişti. Listeyi yenileyip tekrar deneyiniz.' });
        }
        console.error(error);
        res.status(500).json({ error: 'Komisyon başkanı atanırken bir hata oluştu.' });
    }
};

export const getCommissionStatus = async (req, res) => {
    try {
        // Find the Commission Chair and Commission Member roles
        const chairRole = await prisma.role.findUnique({
            where: { name: 'Commission Chair' }
        });

        const memberRole = await prisma.role.findUnique({
            where: { name: 'Commission Member' }
        });

        if (!chairRole && !memberRole) {
            return res.json([]);
        }

        // Get all departments with their commission chairs and members
        const departments = await prisma.department.findMany({
            include: {
                users: {
                    where: {
                        OR: [
                            { roleId: chairRole?.id },
                            { roleId: memberRole?.id }
                        ]
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        roleId: true,
                        createdAt: true
                    },
                    orderBy: {
                        createdAt: 'asc'
                    }
                }
            }
        });

        // Format the response
        const commissionStatus = departments.map(dept => {
            const chair = dept.users.find(u => u.roleId === chairRole?.id);
            const members = dept.users.filter(u => u.roleId === memberRole?.id);
            
            return {
                departmentName: dept.name,
                chairName: chair ? chair.name : null,
                member1: members[0] ? members[0].name : null,
                member2: members[1] ? members[1].name : null
            };
        }).filter(item => item.chairName || item.member1 || item.member2); // Include departments with any commission member

        res.json(commissionStatus);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Komisyon durumu getirilirken bir hata oluştu.' });
    }
};

// Get commission members for a specific department
export const getDepartmentMembers = async (req, res) => {
    try {
        const departmentId = parseInt(req.params.departmentId);

        // Find Commission Member role
        const memberRole = await prisma.role.findUnique({
            where: { name: 'Commission Member' }
        });

        if (!memberRole) {
            return res.json([]);
        }

        // Find members for this department
        const members = await prisma.user.findMany({
            where: {
                departmentId: departmentId,
                roleId: memberRole.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                username: true,
                createdAt: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });

        res.json(members);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Komisyon üyeleri getirilirken bir hata oluştu.' });
    }
};

// Create new commission member
export const createCommissionMember = async (req, res) => {
    try {
        const { departmentId, firstName, lastName, email, temporaryPassword } = req.body;

        if (!departmentId || !firstName || !lastName || !email || !temporaryPassword) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        // Find Commission Member role
        const memberRole = await prisma.role.findUnique({
            where: { name: 'Commission Member' }
        });

        if (!memberRole) {
            return res.status(404).json({ error: 'Commission Member rolü bulunamadı.' });
        }

        // Create username from first and last name
        const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}`;
        const fullName = `${firstName} ${lastName}`;
        
        // Hash temporary password
        const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

        // Serialize the slot check and insert so concurrent requests cannot add a third member.
        const newMember = await prisma.$transaction(async tx => {
            const count = await tx.user.count({ where: { departmentId, roleId: memberRole.id } });
            if (count >= 2) return null;
            // Create new member with requiresPasswordChange flag set to true
            return tx.user.create({
                data: {
                    name: fullName,
                    username: username,
                    email: email,
                    password: hashedPassword,
                    roleId: memberRole.id,
                    departmentId: departmentId,
                    requiresPasswordChange: true
                },
                include: {
                    role: true,
                    department: true
                }
            });

        }, { isolationLevel: 'Serializable' });
        if (!newMember) {
            return res.status(400).json({ error: 'Bu bölümde zaten 2 komisyon üyesi bulunmaktadır.' });
        }

        res.json({
            message: 'Komisyon üyesi başarıyla oluşturuldu.',
            user: newMember
        });

    } catch (error) {
        if (error.code === 'P2034') {
            return res.status(409).json({ error: 'Komisyon üyeleri değişti. Listeyi yenileyip tekrar deneyiniz.' });
        }
        console.error(error);
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Bu e-posta veya kullanıcı adı zaten kullanılıyor.' });
        }
        res.status(500).json({ error: 'Komisyon üyesi oluşturulurken bir hata oluştu.' });
    }
};

// Remove commission member
export const removeCommissionMember = async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);

        await prisma.user.delete({
            where: { id: userId }
        });

        res.json({ message: 'Komisyon üyesi başarıyla kaldırıldı.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Komisyon üyesi kaldırılırken bir hata oluştu.' });
    }
};

