const pkg = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

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
    const mobile = '254745502998'
    const name = 'Administrator';
    const role = 'admin';

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, phone) 
      VALUES ($1, $2, $3, $4, $5) 
      ON CONFLICT (email) 
      DO UPDATE SET 
        password_hash = EXCLUDED.password_hash,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        phone = EXCLUDED.phone`,
      [email, hashedPassword, name, role, mobile]
    );

    console.log('Admin account ensured.');
  } catch (err) {
    console.error('Error creating admin account:', err);
  }
}

createAdmin();

module.exports = pool;