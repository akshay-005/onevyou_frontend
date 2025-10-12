// pages/api/fans.ts
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("onevyou1_db_user"); // your DB name
    const collection = db.collection("fans");

    const { name, bio, interests } = req.body;

    if (!name || !bio) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    await collection.insertOne({
      name,
      bio,
      interests,
      createdAt: new Date(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
