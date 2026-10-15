import express from "express";
import { conn } from "../dbconnect";
import { Rider } from "../model/riders";

export const router = express.Router();

router.get("/", async (req, res) => {
    const [rows] = await conn.query("SELECT * FROM riders");
    let rider = rows as Rider[];
    res.json(rider);
});
