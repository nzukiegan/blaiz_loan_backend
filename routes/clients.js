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

    const result = await db.run(
      'INSERT INTO clients (name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [name, email, phone, id_number, address, guarantorName, guarantorPhone, guarantorId]
    );

    const newClient = await db.query('SELECT * FROM clients WHERE id = $1', [result.lastID]);
    
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

    await db.run(
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
      'SELECT COUNT(*) as loanCount FROM loans WHERE clientId = $1',
      [id]
    );
    
    if (clientLoans.loanCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot delete client with existing loans. Please delete loans first.' 
      });
    }

    const result = await db.run('DELETE FROM clients WHERE id = $2', [id]);

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