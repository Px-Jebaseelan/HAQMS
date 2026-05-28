require('dotenv').config();

const required = ['DATABASE_URL', 'JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[FATAL] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  JWT_SECRET:    process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '2h',
  PORT:          parseInt(process.env.PORT || '5000', 10),
  NODE_ENV:      process.env.NODE_ENV || 'development',
  CORS_ORIGIN:   process.env.CORS_ORIGIN || 'http://localhost:3000',
};
