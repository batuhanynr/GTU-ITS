import prisma from '../config/prisma.js';

export async function departmentAccess(req, res, departmentId) {
    if (!req.user?.userId) {
        res.status(401).json({ error: 'Giriş yapmalısınız.' });
        return false;
    }
    const account = await prisma.user.findUnique({ where: { id: req.user.userId }, include: { role: true } });
    // Use the stored department and role rather than values supplied by the client.
    if (!account || !['General Admin', 'Commission Chair', 'Commission Member'].includes(account.role?.name) ||
        (account.role.name !== 'General Admin' && (!account.departmentId || account.departmentId !== Number(departmentId)))) {
        res.status(403).json({ error: 'Bu bölüm için yetkiniz yok.' });
        return false;
    }
    return true;
}
