const express = require('express');
const router = express.Router();
const db = require('../config/database');
const MpesaService = require('../services/mpesaServices');
const mpesaService = new MpesaService();
const sservice = require('../services/smsService');
const smsService = new sservice();
const axios = require('axios');

router.post('/stkpush', async (req, res) => {
  try {
    const { phone, amount, loan_id, client_id, accountReference } = req.body;

    if (!phone || !amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and valid amount are required'
      });
    }

    const formattedPhone = phone.startsWith('0') ? '254' + phone.slice(1) : 
                           phone.startsWith('+') ? phone.slice(1) : phone;

    const accessToken = await mpesaService.getAccessToken();

    const timestamp = mpesaService.getTimestamp();
    const password = mpesaService.generatePassword(process.env.MPESA_SHORT_CODE, process.env.MPESA_PASS_KEY, timestamp);

    const stkPushPayload = {
      BusinessShortCode: process.env.MPESA_SHORT_CODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: process.env.MPESA_SHORT_CODE,
      PhoneNumber: formattedPhone,
      CallBackURL: process.env.MPESA_CALLBACK_URL,
      AccountReference: accountReference || `LOAN${loan_id}`,
      TransactionDesc: `Loan repayment - ${loan_id}`
    };

    const response = await axios.post(
     'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      stkPushPayload,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const result = response.data;

    if (result.ResponseCode === '0') {

      await db.query(
        'INSERT INTO payments (loan_id, client_id, amount, method, reference, status) VALUES ($1, $2, $3, $4, $5, $6)',
        [loan_id, client_id, amount, "mpesa", result.CustomerMessage, "pending"]
      );

      res.json({
        success: true,
        message: 'STK Push sent successfully. Please check your phone to complete payment.',
        checkoutRequestID: result.CheckoutRequestID,
        customerMessage: result.CustomerMessage,
        payment: paymentRecord
      });
    } else {
      throw new Error(result.ResponseDescription || 'STK Push failed');
    }

  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: error.response?.data?.errorMessage || 'Failed to initiate M-Pesa payment'
    });
  }
});

router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;
    
    if (callbackData.Body && callbackData.Body.stkCallback) {
      const stkCallback = callbackData.Body.stkCallback;
      const callbackMetadata = stkCallback.CallbackMetadata;
      const metadataItems = callbackMetadata.Item;
      
      let amount, mpesaReceiptNumber, phoneNumber, transactionDate;
      
      metadataItems.forEach(item => {
        if (item.Name === 'Amount') amount = item.Value;
        if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
        if (item.Name === 'PhoneNumber') phoneNumber = item.Value;
        if (item.Name === 'TransactionDate') transactionDate = item.Value;
      });

      const checkoutRequestID = stkCallback.CheckoutRequestID;

      const paymentRowResult = await db.query(
        'SELECT * FROM payments WHERE reference = $1',
        [checkoutRequestID]
      );
      const paymentRow = paymentRowResult.rows[0];

      if (!paymentRow) {
        if (!paymentRow) {
          await db.query(
            `INSERT INTO payments (status, mpesa_code, amount, reference, method, loan_id, created_at) 
            VALUES ('completed', $1, $2, $3, 'mpesa', $4, NOW())`,
            [mpesaReceiptNumber, amount, mpesaReceiptNumber, loan.id]
          );
        }
      }

      if (stkCallback.ResultCode === 0) {
        await db.query(
          `UPDATE payments SET status = 'completed', mpesa_code = $1, amount = $2, reference = $3, method = 'mpesa', WHERE id = $3`,
          [mpesaReceiptNumber, amount, mpesaReceiptNumber, paymentRow.id]
        );

        const clientResult = await db.query(
          'SELECT * FROM clients WHERE phone_number = $1',
          [phoneNumber]
        );
        const client = clientResult.rows[0];

        if (client) {
          const loanResult = await db.query(
            'SELECT * FROM loans WHERE client_id = $1',
            [client.id]
          );
          const loan = loanResult.rows[0];

          if (loan) {
            const newRemaining = Math.max(0, loan.remaining_balance - amount);
            const newTotalPaid = Number(loan.total_paid) + Number(amount);

            await db.query(
              `UPDATE loans SET remaining_balance = $1, total_paid = $2, updated_at = NOW() WHERE id = $3`,
              [newRemaining, newTotalPaid, loan.id]
            );
          }
          const msg = `Dear ${client.name} we have received your payment of ${amount}. Remaining balance ${newRemaining}. Thank you for your cooperation`
          await smsService.sendSms(phoneNumber, msg)
        }else {
          const ref = `OTHER - ${mpesaReceiptNumber}`
          await db.query(
            `UPDATE payments SET reference = $1 WHERE id = $2`,
            [ref, paymentRow.id]
          );
        }
      } else {
        await db.query(
          `UPDATE payments SET status = 'failed' WHERE id = $1`,
          [paymentRow.id]
        );
      }

      res.sendStatus(200);
    } else {
      return res.status(400).send("Invalid callback format");
    }
  } catch (error) {
    console.error('Callback error:', error);
    res.sendStatus(500);
  }
});
  
router.get('/check-status', async (req, res) => {
    try {
        const { checkoutRequestID } = req.params;

        const paymentQuery = `SELECT * FROM payments WHERE checkout_request_id = $1`;
        const paymentResult = await pool.query(paymentQuery, [checkoutRequestID]);

        if (paymentResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Payment not found'
            });
        }

        const payment = paymentResult.rows[0];

        if (payment.status !== 'pending') {
            return res.json({
                success: true,
                status: payment.status,
                payment: payment
            });
        }

        const result = await mpesaService.checkTransactionStatus(checkoutRequestID);

        if (result.success) {
            res.json({
                success: true,
                status: result.resultCode === '0' ? 'completed' : 'failed',
                description: result.resultDesc,
                payment: payment
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Failed to check status',
                error: result.error
            });
        }

    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;