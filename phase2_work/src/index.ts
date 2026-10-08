import express from 'express';
import { rateLimiter } from './security/rateLimiter';
import { rbacGuard, UserRole } from './security/rbac';
import { authMiddleware } from './core/auth/authMiddleware';

const app = express();

app.use(express.json());

const globalLimiter = rateLimiter({
  windowMs: 60 * 1000,
  max: 100,
});
app.use(globalLimiter);

const strictAuthLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

app.post('/api/account/alter', strictAuthLimiter, authMiddleware, rbacGuard(UserRole.USER), (_req, res) => {
  res.status(200).json({ 
    success: true, 
    message: 'Daten erfolgreich und sicher aktualisiert.' 
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server läuft auf Port ${PORT} mit aktivierten Sicherheits-Middlewares.`);
});
