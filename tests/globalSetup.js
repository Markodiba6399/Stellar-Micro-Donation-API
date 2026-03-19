// Global setup - runs once before all test suites
process.env.MOCK_STELLAR = 'true';
process.env.API_KEYS = 'test-key-1,test-key-2';
process.env.NODE_ENV = 'test';

module.exports = async () => {
  try {
    const Database = require('../src/utils/database');
    // Create required tables
    await Database.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      publicKey TEXT NOT NULL UNIQUE,
      encryptedSecret TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await Database.run(`CREATE TABLE IF NOT EXISTS idempotency_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      response TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await Database.run(`CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
      receiverId INTEGER NOT NULL,
      amount REAL NOT NULL,
      memo TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      idempotencyKey TEXT UNIQUE
    )`);
    await Database.run(`CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      created_by TEXT,
      metadata TEXT,
      expires_at INTEGER,
      last_used_at INTEGER,
      deprecated_at INTEGER,
      revoked_at INTEGER,
      created_at INTEGER NOT NULL
    )`);
    await Database.run(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      action TEXT NOT NULL,
      severity TEXT NOT NULL,
      result TEXT NOT NULL,
      userId TEXT,
      requestId TEXT,
      ipAddress TEXT,
      resource TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
  } catch (e) {
    // Ignore errors - tables may already exist
  }
};
