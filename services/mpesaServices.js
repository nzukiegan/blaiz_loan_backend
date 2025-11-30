const axios = require('axios');
require('dotenv').config();

class MpesaService {
    constructor() {
        this.config = {
            consumerKey: process.env.MPESA_CONSUMER_KEY,
            consumerSecret: process.env.MPESA_CONSUMER_SECRET,
            shortCode: process.env.MPESA_SHORT_CODE,
            passKey: process.env.MPESA_PASS_KEY,
            callbackURL: process.env.MPESA_CALLBACK_URL
        };

        console.log(this.config)
    }

    async getAccessToken() {
        try {
            const auth = Buffer.from(
            `${this.config.consumerKey}:${this.config.consumerSecret}`
            ).toString('base64');

            const url = 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

            const response = await axios.get(url, {
            headers: {
                Authorization: `Basic ${auth}`
            }
            });

            const token = response.data.access_token;
            console.log('Access token:', token);
            return token;
        } catch (error) {
            console.error('Error getting access token:', error.response ? error.response.data : error.message);
            throw error;
        }
        }

    getTimestamp() {
        const date = new Date();
        return (
            date.getFullYear() +
            ('0' + (date.getMonth() + 1)).slice(-2) +
            ('0' + date.getDate()).slice(-2) +
            ('0' + date.getHours()).slice(-2) +
            ('0' + date.getMinutes()).slice(-2) +
            ('0' + date.getSeconds()).slice(-2)
        );
    }

    generatePassword(shortcode, passkey, timestamp) {
        const data = shortcode + passkey + timestamp;
        return Buffer.from(data).toString('base64');
    }

    async checkTransactionStatus(checkoutRequestID) {
        try {
            const accessToken = await this.getAccessToken();
            const timestamp = this.getTimestamp();
            const password = this.generatePassword(this.config.shortCode, this.config.passKey, timestamp);

            const queryPayload = {
                BusinessShortCode: this.config.shortCode,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            };

            const response = await axios.post(
                'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
                queryPayload,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                ...response.data
            };

        } catch (error) {
            console.error('Status check error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.errorMessage || 'Failed to check status'
            };
        }
    }
}

module.exports = MpesaService;