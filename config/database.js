const pkg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function deleteTable() {
  try {
    // drop table
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    console.log(`Table deleted successfully`);
  } catch (err) {
    console.error('Error deleting table:', err);
  }
}


async function initDb() {
  try {
    const schemaPath = path.join(process.cwd(), './database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(schema);
    console.log('Database schema ensured.');
  } catch (err) {
    console.error('Error initializing database schema:', err);
    throw err;
  }
}

initDb();

async function createAdmin() {
  try {
    const email = 'admin@blaizeloans.co.ke';
    const password = 'blaizloansadmin2546';
    const name = 'Administrator';
    const role = 'admin';

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash, name, role) 
      VALUES ($1, $2, $3, $4) 
      ON CONFLICT (email) 
      DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role`,
      [email, hashedPassword, name, role]
    );

    console.log('Admin account ensured.');
  } catch (err) {
    console.error('Error creating admin account:', err);
  }
}

createAdmin();

module.exports = pool;