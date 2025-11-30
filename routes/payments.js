const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const payments = await db.query(`
      SELECT p.*, l.client_name, l.client_id 
      FROM payments p 
      LEFT JOIN loans l ON p.loan_id = l.id 
      ORDER BY p.created_at DESC
    `);
    
    res.json({ success: true, data: payments });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { loan_id, client_id, amount, method, reference, mpesaCode } = req.body;
    
    if (!loan_id || !amount || !method) {
      return res.status(400).json({ 
        success: false, 
        message: 'Loan, amount, and method are required.' 
      });
    }

    const loanRslt = await db.query('SELECT * FROM loans WHERE id = $1', [loan_id]);
    const loan = loanRslt.rows[0]
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }

    const result = await db.query(
      'INSERT INTO payments (loan_id, client_id, amount, method, reference, mpesa_code) VALUES ($1, $2, $3, $4, $5, $6)',
      [loan_id, client_id, amount, method, reference, mpesaCode]
    );

    if (reference && reference.startsWith('PENALTY-')) {
      await db.query(
        'UPDATE penalties SET status = $1 WHERE loan_id = $2 AND client_id = $3 AND status = $4',
        ['paid', loan_id, client_id, 'active']
      );
    }
    
    const newBalance = loan.remaining_balance - amount;
    const totalPaid = (loan.total_paid || 0) + amount;
    const newStatus = newBalance <= 0 ? 'paid' : loan.status;
    await db.query(
      'UPDATE loans SET remaining_balance = $1, total_Paid = $2, status = $3 WHERE id = $4',
      [newBalance, totalPaid, newStatus, loan_id]
    );

    const newPayment = await db.query(`
      SELECT p.*, l.client_name 
      FROM payments p 
      LEFT JOIN loans l ON p.loan_id = l.id 
      WHERE p.id = $1
    `, [result.lastID]);
    
    res.json({ 
      success: true, 
      message: 'Payment recorded successfully!',
      data: newPayment 
    });
  } catch (error) {
    console.error('Error creating payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;