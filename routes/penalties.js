const express = require('express');
const router = express.Router();
const db = require('../config/database');
const sservice = require('../services/smsService');
const smsService = new sservice();

router.get('/', async (req, res) => {
  try {
    const penalties = await db.query(`
      SELECT p.*, l.client_name, l.client_id 
      FROM penalties p 
      LEFT JOIN loans l ON p.loan_id = l.id 
      ORDER BY p.created_at DESC
    `);
    
    res.json({ success: true, data: penalties });
  } catch (error) {
    console.error('Error fetching penalties:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { loan_id, client_id, amount, reason } = req.body;
    
    if (!loan_id || !amount || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Loan, amount, and reason are required.' 
      });
    }

    const loan = await db.query('SELECT * FROM loans WHERE id = $1', [loan_id]);
    if (!loan) {
      return res.status(404).json({ 
        success: false, 
        message: 'Loan not found.' 
      });
    }

    const result = await db.query(
      'INSERT INTO penalties (loan_id, client_id, amount, reason) VALUES ($1, $2, $3, $4)',
      [loan_id, client_id, amount, reason]
    );

    const newPenaltiesTotal = (loan.penalties || 0) + parseFloat(amount);
    await db.query(
      'UPDATE loans SET penalties = $1 WHERE id = $2',
      [newPenaltiesTotal, loan_id]
    );

    const newPenalty = await db.query(`
      SELECT p.*, l.client_name 
      FROM penalties p 
      LEFT JOIN loans l ON p.loan_id = l.id 
      WHERE p.id = $1
    `, [result.lastID]);

    const clientRst = await db.query(
      'SELECT phone FROM clients WHERE id = $1',
      [client_id]
    );
    
    const phone = clientRst.rows[0].phone

    await smsService.sendSms(phone, `Dear ${loan.client_name}, your loan of ${loan.amount} has been applied a penalty of of ${amount} due to ${reason}`);

    res.json({ 
      success: true, 
      message: 'Penalty applied successfully!',
      data: newPenalty 
    });
  } catch (error) {
    console.error('Error creating penalty:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/waive', async (req, res) => {
  try {
    const { id } = req.params;

    const penaltySlt = await db.query('SELECT * FROM penalties WHERE id = $1', [id]);
    const penalty = penaltySlt.rows[0]
    if (!penalty) {
      return res.status(404).json({ 
        success: false, 
        message: 'Penalty not found.' 
      });
    }
    if (penalty.status !== 'active') {
      return res.status(400).json({ 
        success: false, 
        message: 'Only active penalties can be waived.' 
      });
    }

    await db.query(
      `UPDATE penalties SET status = 'waived', waived_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    const updatedPenalty = await db.query('SELECT * FROM penalties WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Penalty waived successfully!',
      data: updatedPenalty 
    });
  } catch (error) {
    console.error('Error waiving penalty:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;