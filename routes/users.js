const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../db'); // pg pool instance
const SMSService = require('../services/smsService');

const smsService = new SMSService();

/**
 * GET all users (without passwords)
 */
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, email, role, phone, id_number, address, purpose, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * CREATE user
 */
router.post('/users', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      id_number,
      address,
      purpose
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required'
      });
    }

    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await db.query(
      `
      INSERT INTO users (
        name, email, password_hash, role, phone, id_number, address, purpose
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id, name, email, role, phone, created_at
      `,
      [name, email, passwordHash, role, phone || null, id_number || null, address || null, purpose || null]
    );

    const msg = `
Hello ${name},

Your account has been created.

Email: ${email}
Password: ${password}

Please change your password after first login.

Role: ${role}
    `;

    if (phone) smsService.sendSms(phone, msg);

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * GET single user
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT id, name, email, role, phone, id_number, address, purpose, created_at
      FROM users WHERE id = $1
      `,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * UPDATE user
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, role, phone, address, purpose } = req.body;

    const result = await db.query(
      `
      UPDATE users
      SET name = COALESCE($1,name),
          role = COALESCE($2,role),
          phone = COALESCE($3,phone),
          address = COALESCE($4,address),
          purpose = COALESCE($5,purpose),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, name, email, role, phone
      `,
      [name, role, phone, address, purpose, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * DELETE user
 */
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

/**
 * ADMIN reset user password
 */
router.post('/:id/reset-password', async (req, res) => {
  try {
    const userResult = await db.query(
      'SELECT id, name, phone FROM users WHERE id = $1',
      [req.params.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newPassword = crypto.randomBytes(6).toString('hex');
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, req.params.id]
    );

    const msg = `
Hello ${userResult.rows[0].name},

Your password has been reset.

New password: ${newPassword}
Please change it after login.
    `;

    smsService.sendSms(userResult.rows[0].phone, msg);

    res.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;