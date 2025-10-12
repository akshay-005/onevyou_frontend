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

    await client.messages.create({
      from: whatsappNumber,
      to: `whatsapp:${phoneNumber}`,
      body: `Hi ${userName}! 🎉\n\nYour ONEVYOU verification code is: *${otp}*\n\nThis code will expire in 10 minutes.`
    });

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Twilio error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
