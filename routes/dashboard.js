const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/stats', async (req, res) => {
    try {
        const totalLoans = (await db.one('SELECT COUNT(*) FROM loans')).count;
        const activeLoans = (await db.one(`SELECT COUNT(*) FROM loans WHERE status IN ('active', 'approved')`)).count;
        const pendingLoans = (await db.one(`SELECT COUNT(*) FROM loans WHERE status = 'pending')`)).count;
        const totalPaymentsRow = await db.one(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'`);
        const totalPayments = totalPaymentsRow.total;
        const totalClients = (await db.one('SELECT COUNT(*) FROM clients')).count;
        const totalUsers = (await db.one('SELECT COUNT(*) FROM users')).count;
        const overdueLoans = (await db.one(`SELECT COUNT(*) FROM loans WHERE due_date < NOW() AND remaining_balance > 0`)).count;

        const stats = {
            totalLoans: totalLoans,
            activeLoans: activeLoans,
            pendingLoans: pendingLoans,
            totalPayments: totalPayments,
            totalClients: totalClients,
            totalUsers: totalUsers,
            overdueLoans: overdueLoans
        };
      
      res.json({ success: true, ...stats });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

module.exports = router;