import type { NextApiRequest, NextApiResponse } from "next";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER!;

const client = twilio(accountSid, authToken);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { phoneNumber, otp, userName } = req.body;

    // ✅ Step 1: Send WhatsApp OTP via Twilio
    await client.messages.create({
      from: whatsappNumber,
      to: `whatsapp:${phoneNumber.startsWith("+") ? phoneNumber : `+91${phoneNumber}`}`,
      body: `Hi ${userName || "User"}! 🎉\n\nYour ONEVYOU verification code is: *${otp}*\n\nThis code will expire in 10 minutes.`
    });

    // ✅ Step 2: Store OTP in backend Mongo
    await fetch("https://onevyou.onrender.com/api/auth/store-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, otp }),
    });

    console.log(`✅ OTP sent and stored successfully for ${phoneNumber}`);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("❌ Twilio error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
