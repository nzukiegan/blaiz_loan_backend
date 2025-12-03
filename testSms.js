require("dotenv").config();
const SmsService = require("./services/smsService");

async function testSms() {
  const sms = new SmsService();

  try {
    await sms.sendSms(
      "254745502998",
      "Hello! This is a test message."
    );

    console.log("SMS sent (or attempted). Check API response above.");
  } catch (err) {
    console.error("Error sending SMS:", err.response?.data || err.message);
  }
}

testSms();
