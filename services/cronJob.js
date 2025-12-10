const cron = require('node-cron');
const db = require('../config/database');
const sservice = require('./smsService');
const smsService = new sservice();

async function sendDailyLoanReminders() {
  try {
    const { rows: loans } = await db.query(`
      SELECT l.id, l.client_id, l.client_name, l.due_date, l.remaining_balance, l.amount, l.penalty_rate,
             c.phone
      FROM loans l
      JOIN clients c ON l.client_id = c.id
      WHERE l.status IN ('active','overdue')
    `);
    
    for (const loan of loans) {
  const today = new Date().toISOString().slice(0, 10);

  // Only process loans that have a payment start date
  if (!loan.payment_start_date) continue;

  // Reminder for due today
  if (loan.due_date.toISOString().slice(0, 10) === today) {
    const reminderMsg = `Dear ${loan.client_name}, your loan payment of KES ${loan.installment_amount} is due today.`;

    await smsService.sendSms([loan.phone], reminderMsg);

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, priority, related_entity, related_entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        loan.client_id,
        'Loan Payment Reminder',
        reminderMsg,
        'loan',
        'high',
        loan.id.toString(),
        'loan',
      ]
    );
  }

  // Apply penalty for overdue installments
  if (loan.due_date < new Date() && loan.remaining_balance > 0) {
    // Penalty based on installment_amount
    const penaltyAmount = (loan.installment_amount * loan.penalty_rate) / 100;

    await db.query(
      `INSERT INTO penalties (loan_id, client_id, amount, reason)
       VALUES ($1,$2,$3,$4)`,
      [loan.id, loan.client_id, penaltyAmount, 'Installment defaulted']
    );

    await db.query(
      `UPDATE loans
       SET penalties = penalties + $1,
           remaining_balance = remaining_balance + $1,
           status = 'overdue',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [penaltyAmount, loan.id]
    );

    const penaltyMsg = `Dear ${loan.client_name}, a penalty of KES ${penaltyAmount} has been applied for defaulting your installment. Your new balance is KES ${loan.remaining_balance + penaltyAmount}.`;

    await smsService.sendSms([loan.phone], penaltyMsg);

    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, priority, related_entity, related_entity_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        loan.client_id,
        'Loan Penalty Applied',
        penaltyMsg,
        'penalty',
        'high',
        loan.id.toString(),
        'loan',
      ]
    );
  }
}

    
  } catch (err) {
    console.error('Error sending loan reminders/penalties:', err);
  }
}

cron.schedule('0 0 * * *', sendDailyLoanReminders);

module.exports = { sendDailyLoanReminders };