import express from "express";
import { conn } from "../dbconnect";
import { DeliveryRoute } from "../model/delivery-routes";

export const router = express.Router();

router.get("/", async (req, res) => {
    const [rows] = await conn.query("SELECT * FROM delivery_routes");
    let deliveryRoutes = rows as DeliveryRoute[];
    res.json(deliveryRoutes);
});
