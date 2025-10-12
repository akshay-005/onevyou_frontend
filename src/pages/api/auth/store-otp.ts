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
    const db = client.db("onevyou"); // you can change DB name

    await db.collection("otps").updateOne(
      { phoneNumber },
      {
        $set: {
          otp,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        },
      },
      { upsert: true }
    );

    res.status(200).json({ success: true });
  } catch (error: any) {
    console.error("Store OTP error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}
