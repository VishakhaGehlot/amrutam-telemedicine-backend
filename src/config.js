const dotenv = require('dotenv');
dotenv.config();

function loadConfig() {
  if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  return {
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/amrutam',
    jwtSecret: process.env.JWT_SECRET || 'local_development_secret_change_me_123456',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    nodeEnv: process.env.NODE_ENV || 'development'
  };
}
module.exports = { loadConfig };
