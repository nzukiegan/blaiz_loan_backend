const https = require('https');

class SmsService {
  constructor() {
    this.auth = process.env.BULK_SMS_AUTHORIZATION
  }

  sendSms(toNumbers, message) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        to: toNumbers,
        body: message
      });

      const options = {
        hostname: process.env.BULK_SMS_API_URL,
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'Authorization': 'Basic ' + this.auth
        }
      };

      const req = https.request(options, (resp) => {
        let data = '';
        resp.on('data', (chunk) => { data += chunk; });
        resp.on('end', () => resolve({ statusCode: resp.statusCode, body: data }));
      });

      req.on('error', (e) => reject(e));
      req.write(postData);
      req.end();
    });
  }
}

module.exports = SmsService;