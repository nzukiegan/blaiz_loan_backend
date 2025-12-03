const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const JWT_SECRET = process.env.JWT_SECRET
const { sendEmail } = require('../utils/emailService');

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ where: { email } });
    
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists with this email, a reset code has been sent.' 
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    
    user.reset_password_otp = otp;
    user.reset_password_expires = new Date(Date.now() + 10 * 60 * 1000);
    
    await user.save();

    const emailSubject = 'Password Reset Code';
    const emailText = `
      Hello ${user.name},
      
      You requested a password reset. Your one-time code is: ${otp}
      
      This code will expire in 10 minutes.
      
      If you didn't request this, please ignore this email.
      
      Best regards,
      Your App Team
    `;

    await sendEmail(user.email, emailSubject, emailText);

    res.status(200).json({ 
      message: 'Reset code sent to your email.' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => { 

});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.'
      });
    }

    const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials.'
      });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: userWithoutPassword,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, name, role, phone, id_number, address, idPhotoFront, idPhotoBack, passportPhoto, guarantor_name, guarantor_phone, guarantor_id} = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, name, and role are required.'
      });
    }

    if (!['admin', 'loan_officer', 'client'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, loan_officer, or client.'
      });
    }

    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir);
    }

    const saveBase64Image = (base64Data, filename) => {
      const filePath = path.join(uploadDir, filename);
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Image, 'base64');
      fs.writeFileSync(filePath, buffer);
      return filePath;
    };

    let idFrontPath = '';
    let idBackPath = '';
    let passportPath = '';

    if (idPhotoFront) {
      idFrontPath = saveBase64Image(idPhotoFront, `${Date.now()}_idFront.png`);
    }
    if (idPhotoBack) {
      idBackPath = saveBase64Image(idPhotoBack, `${Date.now()}_idBack.png`);
    }
    if (passportPhoto) {
      passportPath = saveBase64Image(passportPhoto, `${Date.now()}_passport.png`);
    }

    const qResults = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = qResults[0];
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'User already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

   const result = await db.query(
      'INSERT INTO users (email, password_hash, name, role, phone, id_number, address, id_photo_front, id_photo_back, passport_photo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id',
      [email, hashedPassword, name, role, phone, id_number, address, idFrontPath, idBackPath, passportPath]
    );

    const newUser = await db.query(
      'SELECT id, email, name, role, phone, id_photo_front, id_photo_back, passport_photo, created_at FROM users WHERE id = $1',
      [result.rows[0].id]
    );

    await db.query(
      'INSERT INTO clients (user_id, name, email, phone, id_number, address, guarantor_name, guarantor_phone, guarantor_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [result.rows[0].id, name, email, phone, id_number, address, guarantor_name, guarantor_phone, guarantor_id]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully!',
      data: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});


module.exports = router;