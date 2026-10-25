import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import nodemailer from 'nodemailer';
import { randomInt } from 'node:crypto';

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user with role and department
        const user = await prisma.user.findUnique({
            where: { email: email },
            include: {
                role: true,
                department: true
            }
        });

        // Error if user is not found
        if (!user) {
            // General error message for security reasons
            return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
        }

        // Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);

        // Error if password is wrong
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Geçersiz e-posta veya şifre.' });
        }

        // Create token
        const token = jwt.sign(
            { userId: user.id, email: user.email },        // Payload
            process.env.JWT_SECRET,                        // Secret
            { expiresIn: process.env.JWT_EXPIRE || '7d' }  // Expiry (configurable)
        );

        // Send token back to user
        res.json({
            message: 'Giriş başarılı!',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                username: user.username,
                role: user.role,
                department: user.department,
                requiresPasswordChange: user.requiresPasswordChange
            }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Giriş yapılırken bir sunucu hatası oluştu.' });
    }
};

// 1. Step: Request Password Reset Code
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Read mail settings at request time, after the application loads its environment.
        if (!process.env.EMAIL_USER?.trim() || !process.env.EMAIL_PASS?.trim()) {
            return res.status(503).json({ error: 'Şifre sıfırlama e-postası yapılandırılmamış. Sistem yöneticinizle iletişime geçiniz.' });
        }
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: 'Bu e-posta adresi ile kayıtlı kullanıcı bulunamadı.' });
        }

        // Generate 6-digit code
        const code = randomInt(100000, 1000000).toString();
        
        // Save to DB (expires in 15 mins)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Remove old tokens for this email
        await prisma.passwordResetToken.deleteMany({
            where: { email }
        });

        await prisma.passwordResetToken.create({
            data: {
                email,
                token: code,
                expiresAt
            }
        });

        try {
            const result = await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: email,
                subject: 'ITS Şifre Sıfırlama Kodu',
                text: `Şifre sıfırlama kodunuz: ${code}\n\nBu kod 15 dakika süreyle geçerlidir.`
            });
            if (!result.accepted?.some(recipient => (recipient.address || recipient) === email)) {
                throw new Error('Recipient not accepted');
            }
        } catch {
            // Remove only the failed request's code, leaving concurrent requests untouched.
            await prisma.passwordResetToken.deleteMany({ where: { email, token: code } });
            return res.status(502).json({ error: 'E-posta gönderilemedi. Lütfen tekrar deneyin veya sistem yöneticinize başvurun.' });
        }

        res.json({ message: 'Doğrulama kodu e-posta adresinize gönderildi.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'İşlem sırasında bir hata oluştu.' });
    }
};

// Max wrong-code attempts before the reset code is locked and must be re-requested.
const MAX_RESET_ATTEMPTS = 5;

// Look up the active code for an email and enforce the attempt limit on a wrong code.
// Returns { error, status } on failure, or { record } on success.
async function checkResetCode(email, code) {
    // Reject missing filters before Prisma can query or update another account's token.
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof code !== 'string' || !/^\d{6}$/.test(code)) {
        return { status: 400, error: 'Geçerli e-posta adresi ve altı haneli kod gereklidir.' };
    }
    const record = await prisma.passwordResetToken.findFirst({
        where: { email, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' }
    });
    if (!record) return { status: 400, error: 'Geçersiz veya süresi dolmuş kod.' };
    if (record.attempts >= MAX_RESET_ATTEMPTS) {
        await prisma.passwordResetToken.deleteMany({ where: { id: record.id } });
        return { status: 429, error: 'Çok fazla hatalı deneme. Lütfen yeni kod isteyin.' };
    }
    if (record.token !== code) {
        // Count the wrong try so the code can be locked after too many attempts.
        await prisma.passwordResetToken.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
        return { status: 400, error: 'Geçersiz veya süresi dolmuş kod.' };
    }
    return { record };
}

// 2. Step: Verify Code
export const verifyResetCode = async (req, res) => {
    try {
        const { email, code } = req.body || {};

        const result = await checkResetCode(email, code);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }

        res.json({ message: 'Kod doğrulandı.', valid: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Doğrulama sırasında hata oluştu.' });
    }
};

// 3. Step: Set New Password
export const resetPasswordWithCode = async (req, res) => {
    try {
        const { email, code, newPassword } = req.body || {};

        // Enforce a minimum password length (matches the client rule).
        if (typeof newPassword !== 'string' || newPassword.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        }

        // Verify the code again, applying the same attempt limit as the verify step.
        const result = await checkResetCode(email, code);
        if (result.error) {
            return res.status(result.status).json({ error: result.error });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Claim the code and update the password together so concurrent resets have one winner.
        const changed = await prisma.$transaction(async tx => {
            const consumed = await tx.passwordResetToken.deleteMany({
                where: { id: result.record.id, email, token: code, attempts: { lt: MAX_RESET_ATTEMPTS }, expiresAt: { gt: new Date() } }
            });
            if (consumed.count !== 1) return false;
            await tx.user.update({ where: { email }, data: { password: hashedPassword } });
            return true;
        });
        if (!changed) {
            return res.status(400).json({ error: 'Geçersiz veya süresi dolmuş kod.' });
        }

        res.json({ message: 'Şifreniz başarıyla güncellendi.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Şifre güncellenirken hata oluştu.' });
    }
};

// Deprecated direct reset (removed/secured)
export const resetPassword = async (req, res) => {
    res.status(405).json({ error: 'Use secure flow using codes.' });
};

export const changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Tüm alanlar zorunludur.' });
        }

        // Enforce a minimum password length (matches the client rule).
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Şifre en az 6 karakter olmalıdır.' });
        }

        // Identify the user from the authenticated token, not the request body.
        const user = await prisma.user.findUnique({
            where: { id: req.user.userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Mevcut şifre yanlış.' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password and set requiresPasswordChange to false
        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedNewPassword,
                requiresPasswordChange: false
            }
        });

        res.json({ message: 'Şifre başarıyla değiştirildi.' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Şifre değiştirilirken bir hata oluştu.' });
    }
};
