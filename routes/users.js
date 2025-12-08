const express = require('express');
const router = express.Router();
const ssService = require('../services/smsService')
const smsService = new ssService();

router.get('/', (req, res) => {
  try {
    const usersWithoutPasswords = users.map(({ password, ...user }) => user);
    res.json({ success: true, users: usersWithoutPasswords });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

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

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await db.query(
      `INSERT INTO users (
        name, email, password_hash, role, phone, id_number, address, purpose, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
      RETURNING id, name, email, role, phone, created_at`,
      [name, email, passwordHash, role, phone || null, id_number || null, address || null, purpose || null]
    );

    const msg = `
      Hello ${name},
      
      Your account has been created on the Loan Management System.
      
      Login Credentials:
      Email: ${email}
      Password: ${password}
      
      Please change your password after first login.
      
      Role: ${role}
      
      Best regards,
      System Administrator
    `;

    smsService.sendSms(phone, msg)

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: newUser.rows[0]
    });

  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});


router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const user = users.find(u => u.id === id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const { password, ...userWithoutPassword } = user;
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    users[userIndex] = { ...users[userIndex], ...req.body };
    const { password, ...userWithoutPassword } = users[userIndex];
    
    res.json({ success: true, user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    users = users.filter(u => u.id !== id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/reset-password', async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    const userIndex = users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    users[userIndex].password = hashedPassword;
    
    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:userId/reset-user-password', async (req, res) => {
  try {
    const { userId } = req.params;

    const userQuery = await db.query(
      'SELECT id, name, email, phone FROM users WHERE id = $1',
      [userId]
    );

    if (userQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userQuery.rows[0];

    const newPassword = crypto.randomBytes(8).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [passwordHash, userId]
    );

    const nsg = `
      Hello ${user.name},
      
      Your password has been reset by the system administrator.
      
      Your new password is: ${newPassword}
      
      Please login and change your password immediately.
      
      If you did not request this change, please contact your administrator.
      
      Best regards,
      System Administrator
    `;

    smsService.sendSms(user.phone, msg)

    res.json({
      success: true,
      message: 'Password reset successful. New password sent to user\'s email.'
    });

  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({
      success: false,
      message: 'Server error. Please try again.'
    });
  }
});

module.exports = router;