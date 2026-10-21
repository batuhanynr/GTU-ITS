import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Token bulunamadı.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Geçersiz token.' });
        }
        req.user = user;
        next();
    });
};

export const requireRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const prisma = req.app.locals.prisma;
            const user = await prisma.user.findUnique({
                where: { id: req.user.userId },
                include: { role: true }
            });

            if (!user || !allowedRoles.includes(user.role.name)) {
                return res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
            }

            req.account = user;
            next();
        } catch (error) {
            res.status(500).json({ error: 'Yetki kontrolü yapılırken bir hata oluştu.' });
        }
    };
};
