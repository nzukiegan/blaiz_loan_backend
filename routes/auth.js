const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto =  require('crypto')
const jwt = require('jsonwebtoken');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const JWT_SECRET = process.env.JWT_SECRET
const ssService = require('../services/smsService')
const smsService = new ssService();

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
    );
    const user = result.rows[0];
    
    if (!user) {
      return res.status(200).json({ 
        message: 'If an account exists with this email, a reset code has been sent.' 
      });
    }

    const otp = crypto.randomInt(100000, 999999).toString();

    await db.query('UPDATE users SET reset_password_otp = $1, reset_password_expires = $2 WHERE email = $3',
      [otp, new Date(Date.now() + 10 * 60 * 1000), email]
    )

    const msg = `
      Hello ${user.name},
      
      You requested a password reset. Your one-time code is: ${otp}
      
      This code will expire in 10 minutes.
      
      If you didn't request this, please ignore this text.
      
      Best regards,
      Your App Team
    `;

    smsService.sendSms(user.phone, msg)

    res.status(200).json({ 
      message: 'Reset code sent to your sms.' 
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => { 
  try {
    const { email, otp, newPassword } = req.body;

    const result = await db.query(
    'SELECT * FROM users WHERE email = $1',
    [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid reset request.' });
    }

    if (!user.reset_password_otp || !user.reset_password_expires) {
      return res.status(400).json({ message: 'Reset code has expired or is invalid.' });
    }

    if (new Date() > user.reset_password_expires) {
      return res.status(400).json({ message: 'Reset code has expired.' });
    }

    if (user.reset_password_otp !== otp) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.query('UPDATE users SET password = $1, reset_password_otp = $2, reset_password_expires = $3 WHERE email = $4',
      [hashedPassword, null, null, email]
    )
    
    res.status(200).json({ 
      message: 'Password reset successful. You can now login with your new password.' 
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
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

    if (!email || !password || !name || !role || !phone || !id_number || !address || !idPhotoFront || !idPhotoBack || !passportPhoto || !guarantor_name || !guarantor_phone || !guarantor_id) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!['admin', 'loan_officer', 'client'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Must be admin, loan_officer, or client.'
      });
    }

    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }


    const uploadImage = async (base64Image) => {
      try {
        const data = base64Image.startsWith('data:image')
          ? base64Image
          : `data:image/png;base64,${base64Image}`;

        const result = await cloudinary.uploader.upload(data);
        return result.secure_url;
      } catch (err) {
        console.error('Cloudinary upload error:', err);
        return null;
      }
    };
    

    let idFrontPath = '';
    let idBackPath = '';
    let passportPath = '';

    if (idPhotoFront) {
      idFrontPath = await uploadImage(idPhotoFront);
    }
    if (idPhotoBack) {
      idBackPath = await uploadImage(idPhotoBack);
    }
    if (passportPhoto) {
      passportPath = await uploadImage(passportPhoto);
    }

    const qResults = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    const existingUser = qResults.rows[0];
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
    const msg = `Hello ${name}, Welcome to blaiz loans, Your registration detailes has been received. Login to your accout, go to dashboard and apply loan`
    smsService.sendSms(phone, msg)
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