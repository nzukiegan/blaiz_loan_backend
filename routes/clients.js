const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const clients = await db.query(`
      SELECT 
        c.*,
        u.id AS user_id,
        u.email AS user_email,
        u.name AS user_name,
        u.role AS user_role,
        u.phone AS user_phone,
        u.id_number AS user_id_number,
        u.address AS user_address,
        u.id_photo_back,
        u.id_photo_front,
        u.passport_photo
      FROM clients c
      LEFT JOIN users u ON c.user_id = u.id
      ORDER BY c.created_at DESC
    `);

    res.json({ success: true, data: clients.rows });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/apply', async (req, res) => {
   try {
    const {
      user_id,
      amount,
      purpose,
      term,
      term_unit,
      installment_frequency
    } = req.body;


    if (!amount || !purpose || !term || !installment_frequency || !term_unit) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    const clientQuery = await db.query(
      'SELECT id, name, phone, id_number FROM clients WHERE user_id = $1',
      [user_id]
    );

    if (clientQuery.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found. Please complete your profile first.'
      });
    }

    const client = clientQuery.rows[0];

    const interestRate = 5;
    const penaltyRate = 2.5;
    const termUnit = term_unit;
    const totalInterest = (parseFloat(amount) * interestRate) / 100;
    const totalAmount = parseFloat(amount) + totalInterest;
    const installmentAmount = totalAmount / parseInt(term);
    
    // Calculate due date (term months from now)
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + parseInt(term));

    // Insert loan application
    const loanQuery = await db.query(
      `INSERT INTO loans (
        client_id, 
        client_name, 
        amount, 
        interest_rate, 
        term, 
        term_unit, 
        installment_frequency, 
        penalty_rate, 
        status, 
        installment_amount, 
        remaining_balance, 
        due_date,
        purpose,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        client.id,
        client.name,
        parseFloat(amount),
        interestRate,
        parseInt(term),
        termUnit,
        installment_frequency,
        penaltyRate,
        'pending',
        installmentAmount.toFixed(2),
        totalAmount.toFixed(2),
        dueDate,
        purpose
      ]
    );

    await db.query(
      `INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        priority,
        related_entity_type,
        related_entity,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
      [
        client.id,
        'New Loan Application',
        `${client.name} has applied for a loan of KES ${parseFloat(amount).toLocaleString()}`,
        'loan',
        'medium',
        'loan',
        loanQuery.rows[0].id
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Loan application submitted successfully!',
      data: loanQuery.rows[0]
    });

  } catch (error) {
    console.error('Loan application error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Unknown error",
      stack: error.stack,
      details: error
    });
  }
});

router.get("/:id/download", async (req, res) => {
  const clientId = req.params.id;

  try {
    const client = await db.query(
      `SELECT * FROM clients WHERE id = $1`,
      [clientId]
    );

    if (client.rows.length === 0) {
      return res.status(404).json({ message: "Client not found" });
    }

    const c = client.rows[0];

    const user = await db.query(
      `SELECT * FROM users WHERE id = $1`,
      [c.user_id]
    );

    const loans = await db.query(
      `SELECT * FROM loans WHERE client_id = $1`,
      [clientId]
    );

    const payments = await db.query(
      `SELECT * FROM payments WHERE client_id = $1`,
      [clientId]
    );

    const penalties = await db.query(
      `SELECT * FROM penalties WHERE client_id = $1`,
      [clientId]
    );

    const doc = new PDFDocument();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=client_${clientId}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(22).text("Client Report", { align: "center" }).moveDown();

    doc.fontSize(15).text("CLIENT INFORMATION");
    doc.fontSize(12)
      .text(`Name: ${c.name}`)
      .text(`Email: ${c.email}`)
      .text(`Phone: ${c.phone}`)
      .text(`ID Number: ${c.id_number}`)
      .text(`Address: ${c.address}`)
      .moveDown();

    doc.fontSize(15).text("GUARANTOR INFORMATION");
    doc.fontSize(12)
      .text(`Guarantor Name: ${c.guarantor_name}`)
      .text(`Guarantor Phone: ${c.guarantor_phone}`)
      .text(`Guarantor ID: ${c.guarantor_id}`)
      .moveDown();

    doc.fontSize(15).text("LOANS").moveDown(0.5);

    if (loans.rows.length === 0) {
      doc.text("No loans found").moveDown();
    } else {
      loans.rows.forEach((loan, i) => {
        doc.fontSize(12)
          .text(`Loan #${i + 1}`)
          .text(`Amount: ${loan.amount}`)
          .text(`Interest Rate: ${loan.interest_rate}`)
          .text(`Term: ${loan.term} ${loan.term_unit}`)
          .text(`Installment Frequency: ${loan.installment_frequency}`)
          .text(`Penalty Rate: ${loan.penalty_rate}`)
          .text(`Status: ${loan.status}`)
          .text(`Remaining Balance: ${loan.remaining_balance}`)
          .text(`Total Paid: ${loan.total_paid}`)
          .moveDown();
      });
    }

    doc.fontSize(15).text("PAYMENTS").moveDown(0.5);

    if (payments.rows.length === 0) {
      doc.text("No payments found").moveDown();
    } else {
      payments.rows.forEach((p, i) => {
        doc.fontSize(12)
          .text(`Payment #${i + 1}`)
          .text(`Amount: ${p.amount}`)
          .text(`Method: ${p.method}`)
          .text(`Reference: ${p.reference}`)
          .text(`Date: ${p.payment_date}`)
          .moveDown();
      });
    }

    doc.fontSize(15).text("PENALTIES").moveDown(0.5);

    if (penalties.rows.length === 0) {
      doc.text("No penalties found").moveDown();
    } else {
      penalties.rows.forEach((p, i) => {
        doc.fontSize(12)
          .text(`Penalty #${i + 1}`)
          .text(`Amount: ${p.amount}`)
          .text(`Reason: ${p.reason}`)
          .text(`Status: ${p.status}`)
          .moveDown();
      });
    }

    doc.end();
  } catch (error) {
    console.error("PDF download error:", error);
    res.status(500).json({ message: "Server error generating PDF" });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found.' 
      });
    }
    
    res.json({ success: true, data: client });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId } = req.body;
    
    if (!name || !phone || !id_number) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, phone, and ID number are required.' 
      });
    }

    const existingClient = await db.query('SELECT id FROM clients WHERE id_number = $1', [id_number]);
    if (existingClient) {
      return res.status(400).json({ 
        success: false, 
        message: 'Client with this ID number already exists.' 
      });
    }

    const result = await db.query(
      'INSERT INTO clients (name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id',
      [name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId]
    );

    const newClient = await db.query('SELECT * FROM clients WHERE id = $1', [result.rows[0].id]);
    
    res.json({ 
      success: true, 
      message: 'Client created successfully!',
      data: newClient 
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId } = req.body;

    const existingClient = await db.query('SELECT id FROM clients WHERE id = $1', [id]);
    if (!existingClient) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found.' 
      });
    }

    await db.query(
      'UPDATE clients SET name = $1, email = $2, phone = $3, id_number = $4, address = $5, guarantorName = $6, guarantorPhone = $7, guarantorId = $8 WHERE id = $9',
      [name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId, id]
    );

    const updatedClient = await db.query('SELECT * FROM clients WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Client updated successfully!',
      data: updatedClient 
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const client = await db.query('SELECT id FROM clients WHERE id = $1', [id]);
    if (!client) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found.' 
      });
    }

    const clientLoans = await db.query(
      'SELECT COUNT(*) as loanCount FROM loans WHERE client_id = $1',
      [id]
    );
    
    if (clientLoans.loanCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete client with existing loans. Please delete loans first.' 
      });
    }

    const result = await db.query('DELETE FROM clients WHERE id = $1', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Client not found.' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Client deleted successfully!' 
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;