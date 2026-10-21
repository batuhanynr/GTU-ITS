export const memberScope = async (req, res, next) => {
    try {
        const target = req.params.userId && await req.app.locals.prisma.user.findUnique({
            where: { id: Number(req.params.userId) }, include: { role: true }
        });
        if (req.params.userId && (!target || target.role?.name !== 'Commission Member')) {
            return res.status(404).json({ error: 'Komisyon üyesi bulunamadı.' });
        }
        const departmentId = target?.departmentId ?? Number(req.params.departmentId ?? req.body.departmentId);
        // Chairs may manage members only within their own department.
        if (req.account.role.name !== 'General Admin' &&
            (!req.account.departmentId || departmentId !== req.account.departmentId)) {
            return res.status(403).json({ error: 'Bu bölüm için yetkiniz yok.' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Yetki kontrolü başarısız.' });
    }
};
