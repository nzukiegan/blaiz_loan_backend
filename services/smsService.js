const axios = require('axios');
require('dotenv').config();

class SmsService {
  constructor() {
    this.apiUrl = process.env.TEXT_SMS_API_URL
    this.apiKey = process.env.TEXT_SMS_API_KEY
    this.partnerID = process.env.TEXT_SMS_PARTNER_ID
    this.shortcode = process.env.TEXT_SMS_SHORT_CODE
  }

  async sendSms(to, message) {
    const body = {
      apikey: this.apiKey,
      partnerID: this.partnerID,
      shortcode: this.shortcode,
      mobile: to,
      message: message,
      timeToSend: new Date().toISOString()
    };

    const resp = await axios.post(
      this.apiUrl,
      body,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );


    console.log(resp.data)
  }
}

module.exports = SmsService;