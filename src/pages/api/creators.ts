// pages/api/creators.ts
import type { NextApiRequest, NextApiResponse } from "next";
import clientPromise from "@/lib/mongodb";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const client = await clientPromise;
    const db = client.db("skillmeet"); // same DB
    const collection = db.collection("creators");

    const { name, bio, expertise, socials } = req.body;

    if (!name || !bio || !expertise) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    await collection.insertOne({
      name,
      bio,
      expertise,
      socials: socials || {},
      createdAt: new Date(),
    });

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
}
