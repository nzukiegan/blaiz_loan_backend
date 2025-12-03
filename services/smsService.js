const axios = require('axios');

class SmsService {
  constructor() {
    this.apiUrl = process.env.TEXT_SMS_API_URL
    this.auth = process.env.BULK_SMS_AUTHORIZATION
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

    const resp = await axios.post(this.apiUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    console.log(resp)
  }
}

module.exports = SmsService;