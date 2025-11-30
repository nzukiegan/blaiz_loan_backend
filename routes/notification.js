const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    
    let query = `
      SELECT * FROM notifications 
    `;
    let params = [];
    
    if (userId) {
      query += ' WHERE userId = $1';
      params.push(userId);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const notifications = await db.query(query, params);
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { userId, title, message, type, priority, relatedEntity, relatedEntityType } = req.body;
    
    if (!userId || !title || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID, title, and message are required.' 
      });
    }

    const result = await db.query(
      'INSERT INTO notifications (userId, title, message, type, priority, relatedEntity, relatedEntityType) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [userId, title, message, type || 'info', priority || 'medium', relatedEntity, relatedEntityType]
    );

    const newNotification = await db.query('SELECT * FROM notifications WHERE id = $1', [result.lastID]);
    
    res.json({ 
      success: true, 
      message: 'Notification created successfully!',
      data: newNotification 
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await db.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found.' 
      });
    }

    await db.run(
      'UPDATE notifications SET read = 1 WHERE id = $1',
      [id]
    );

    const updatedNotification = await db.query('SELECT * FROM notifications WHERE id = $1', [id]);
    
    res.json({ 
      success: true, 
      message: 'Notification marked as read!',
      data: updatedNotification 
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/mark-all-read', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required.' 
      });
    }

    await db.query(
      'UPDATE notifications SET read = 1 WHERE userId = $1',
      [userId]
    );

    res.json({ 
      success: true, 
      message: 'All notifications marked as read!'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await db.query('SELECT * FROM notifications WHERE id = $1', [id]);
    if (!notification) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found.' 
      });
    }

    const result = await db.query('DELETE FROM notifications WHERE id = $1', [id]);

    if (result.changes === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Notification not found.' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Notification deleted successfully!' 
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;