const express = require('express');
const router = express.Router();
const db = require('../config/database');
const sservice = require('../services/smsService');
const smsService = new sservice();

router.get('/', async (req, res) => {
  try {
    const loans = await db.query(`
      SELECT l.*, c.name as clientName, c.phone as clientPhone 
      FROM loans l 
      LEFT JOIN clients c ON l.client_id = c.id 
      ORDER BY l.created_at DESC
    `);
    
    res.json({ success: true, data: loans });
  } catch (error) {
    console.error('Error fetching loans:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const loan = await db.query(`
      SELECT l.*, c.name as clientName, c.phone as clientPhone, c.email as clientEmail
      FROM loans l 
      LEFT JOIN clients c ON l.client_id = c.id 
      WHERE l.id = $1
    `, [id]);
    
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }
    
    res.json({ success: true, data: loan });
  } catch (error) {
    console.error('Error fetching loan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/api/loans/client/:client_id', async (req, res) => {
  try {
    const { client_id } = req.params;
    const clientLoans = loans.filter(loan => loan.client_id === client_id);
    res.json({ success: true, loans: clientLoans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { client_id, clientName, amount, interestRate, term, term_unit, installment_frequency, penalty_rate, remainingBalance, dueDate } = req.body;
    
    if (!client_id || !amount || !interestRate || !term) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client, amount, interest rate, and term are required.' 
      });
    }

    const client = await db.query('SELECT id FROM clients WHERE id = $1', [client_id]);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found.' 
      });
    }

    const result = await db.query(
      'INSERT INTO loans (client_id, client_name, amount, interest_rate, term, term_unit, penalty_rate, installment_frequency, remaining_balance, due_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)',
      [client_id, clientName, amount, interestRate, term, term_unit, penalty_rate, installment_frequency, remainingBalance, dueDate, 'pending']
    );

    const newLoan = await db.query(`
      SELECT l.*, c.name as client_name
      FROM loans l 
      LEFT JOIN clients c ON l.client_id = c.id 
      WHERE l.id = $1
    `, [result.lastID]);
    
    res.json({ 
      success: true, 
      message: 'Loan created successfully!',
      data: newLoan 
    });
  } catch (error) {
    console.error('Error creating loan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const loanRslt = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    const loan = loanRslt.rows[0];
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }
    
    if (loan.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Loan is not in pending status.' 
      });
    }

    await db.query(
      `UPDATE loans 
      SET status = 'approved', approved_at = CURRENT_TIMESTAMP 
      WHERE id = $1`,
      [id]
    );


    const updatedLoan = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    const clientRslt = await db.query('SELECT phone FROM clients WHERE id = $1', [loan.client_id]);
    const clientPhone = clientRslt.rows[0].phone;

    await smsService.sendSms([clientPhone], `Dear ${loan.client_name}, your loan of ${loan.amount} has been approved successfully.`);

    res.json({ 
      success: true, 
      message: 'Loan approved successfully!',
      data: updatedLoan 
    });
  } catch (error) {
    console.error('Error approving loan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;

    const loanRslt = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    const loan = loanRslt.rows[0];
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }

    if (loan.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: 'Loan is not in pending status.' 
      });
    }

    await db.query(
      "UPDATE loans SET status = 'rejected' WHERE id = $1",
      [id]
    );

    const updatedLoan = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Loan rejected successfully!',
      data: updatedLoan.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting loan:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected', 'active', 'paid', 'overdue'].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid status.' 
      });
    }

    const loanRslt = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    const loan = loanRslt.rows[0]
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }

    await db.query(
      'UPDATE loans SET status = $1 WHERE id = $2',
      [status, id]
    );

    const updatedLoan = await db.query('SELECT * FROM loans WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Loan status updated successfully!',
      data: updatedLoan 
    });
  } catch (error) {
    console.error('Error updating loan status:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;