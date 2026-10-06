import express from "express";
import { conn } from "../dbconnect";
import mysql from "mysql2";
import { Customer } from "../model/customers";
import { CustomerPostRequest } from "../model/customers";
import { SHOP_CONFIG } from "../config/shop";


export const router = express.Router();

router.get("/", async (req, res) => {
    const [rows] = await conn.query("SELECT * FROM customers");
    let customers = rows as Customer[];
    res.json(customers);
});

// ค้นหาลูกค้าในระยะ 1 กิโลเมตร (หรือส่ง ?km=1.5 เพื่อเปลี่ยนระยะได้)
router.get("/near", async (req, res) => {
    try {
        const distanceKm = req.query.km ? parseFloat(req.query.km as string) : 1.0;
        const shopLat = SHOP_CONFIG.latitude;
        const shopLng = SHOP_CONFIG.longitude;

        const sql = `
            SELECT *, 
            ROUND((ST_Distance_Sphere(point(longitude, latitude), point(?, ?)) / 1000), 2) AS distance_km 
            FROM customers 
            HAVING distance_km <= ? 
            ORDER BY distance_km ASC
        `;

        const [rows] = await conn.query(sql, [shopLng, shopLat, distanceKm]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching nearby customers:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/search", async (req, res) => {
    try {
        const [rows] = await conn.query(
            "SELECT * FROM customers WHERE (id IS NULL OR id = ?) OR (name IS NULL OR name LIKE ?)",
            [req.query.id, "%" + req.query.name + "%"]
        );
        res.json(rows);
    } catch (error) {
        // ดักจับ Error กรณีทำงานผิดพลาด เพื่อไม่ให้ระบบหลังบ้านพังล่มไปดื้อๆ
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/:id", async (req, res) => {
    // ใช้เครื่องหมาย ? (Placeholder) เสมอ เพื่อส่งตัวแปรไปแทนค่าในคำสั่ง SQL ป้องกันภัยความปลอดภัย SQL Injection
    const [rows] = await conn.query("SELECT * FROM customers WHERE id = ?", [
        req.params.id,
    ]);
    res.json(rows);
});

router.post("/", async (req, res) => {
    try {
        let customer: CustomerPostRequest = req.body;
        console.log(req.body);

        let sql =
            "INSERT INTO `customers`(`name`, `phone`, `address`, `latitude`, `longitude`) VALUES (?,?,?,?,?)";

        const [result] = await conn.query(sql, [
            customer.name,
            customer.phone,
            customer.address,
            customer.latitude,
            customer.longitude,
        ]);

        // แปลงผลลัพธ์เพื่อนำมาสกัดหาข้อมูลแถวที่ทำรายการสำเร็จ
        const insertResult = result as any;
        res.status(201).json({
            affected_row: insertResult.affectedRows, // จำนวนแถวที่ได้รับผลกระทบ (สำเร็จ = 1)
            last_idx: insertResult.insertId // รหัสไอดีล่าสุดที่ระบบสร้างขึ้นให้อัตโนมัติ (Auto increment id)
        });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        let id = req.params.id;
        const [result] = await conn.query("DELETE FROM customers WHERE id = ?", [id]);
        const deleteResult = result as any;

        // ตรวจเช็กสักนิดว่ามีแถวถูกลบจริงไหม หากไม่มีแสดงว่าไม่พบไอดีในฐานข้อมูล ส่งกลับรหัส 404
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }

        res.status(200).json({ affected_row: deleteResult.affectedRows });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        let id = req.params.id;
        let customer: Customer = req.body;
        let sql =
            "UPDATE `customers` SET `name`=?, `phone`=?, `address`=?, `latitude`=?, `longitude`=? WHERE `id`=?";

        const [result] = await conn.query(sql, [
            customer.name,
            customer.phone,
            customer.address,
            customer.latitude,
            customer.longitude,
            id,
        ]);
        const updateResult = result as any;

        // หากไม่พบไอดีที่จะอัปเดต ส่งรหัส 404 กลับทันที
        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }
        res.status(200).json({ affected_row: updateResult.affectedRows });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.patch("/:id", async (req, res) => {
    let id = +req.params.id; // แปลง id จากข้อความตัวอักษรให้เป็นตัวเลขด้วยสัญลักษณ์ + ข้างหน้า
    let customer: Customer = req.body;

    // 1. ค้นหาข้อมูลเก่าจากไอดีที่ต้องการอัปเดตก่อน
    let sql = mysql.format("SELECT * FROM customers WHERE id = ?", [id]);
    let [response] = await conn.query(sql);
    let result = response as Customer[];

    if (result.length > 0) {
        let customerOriginal = result[0];

        // 2. นำข้อมูลเก่ามาทับด้วยข้อมูลใหม่ที่ส่งมา (ค่าไหนไม่ส่งมาก็จะใช้ค่าเก่าของเดิม)
        let updateCustomer = { ...customerOriginal, ...customer };

        // 3. เขียนข้อมูลที่รวมสำเร็จแล้วกลับลงไปในฐานข้อมูล
        sql =
            "UPDATE `customers` SET `name`=?, `phone`=?, `address`=?, `latitude`=?, `longitude`=? WHERE `id`=?";
        sql = mysql.format(sql, [
            updateCustomer.name,
            updateCustomer.phone,
            updateCustomer.address,
            updateCustomer.latitude,
            updateCustomer.longitude,
            id,
        ]);

        const [records] = await conn.query(sql);
        const updateResult = records as any;
        res.status(200).json({ affected_row: updateResult.affectedRows });
    } else {
        res.status(404).json({ message: "Customer not found" });
    }
});