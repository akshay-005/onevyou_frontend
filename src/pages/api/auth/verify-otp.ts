import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
      return res.status(400).json({ success: false, error: "Missing phone number or OTP" });
    }

    const client = await clientPromise;
    const db = client.db("onevyou");

    const record = await db.collection("otps").findOne({ phoneNumber });

    if (!record) {
      return res.status(400).json({ success: false, error: "OTP not found" });
    }

    if (record.otp !== otp) {
      return res.status(400).json({ success: false, error: "Invalid OTP" });
    }

    if (new Date(record.expiresAt) < new Date()) {
      return res.status(400).json({ success: false, error: "OTP expired" });
    }

    // ✅ OTP is valid → remove it (or mark used)
    await db.collection("otps").deleteOne({ phoneNumber });

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
