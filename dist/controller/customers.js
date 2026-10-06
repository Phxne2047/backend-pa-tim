"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../dbconnect");
const mysql2_1 = __importDefault(require("mysql2"));
const shop_1 = require("../config/shop");
exports.router = express_1.default.Router();
exports.router.get("/", async (req, res) => {
    const [rows] = await dbconnect_1.conn.query("SELECT * FROM customers");
    let customers = rows;
    res.json(customers);
});
// ค้นหาลูกค้าในระยะ 1 กิโลเมตร (หรือส่ง ?km=1.5 เพื่อเปลี่ยนระยะได้)
exports.router.get("/near", async (req, res) => {
    try {
        const distanceKm = req.query.km ? parseFloat(req.query.km) : 1.0;
        const shopLat = shop_1.SHOP_CONFIG.latitude;
        const shopLng = shop_1.SHOP_CONFIG.longitude;
        const sql = `
            SELECT *, 
            ROUND((ST_Distance_Sphere(point(longitude, latitude), point(?, ?)) / 1000), 2) AS distance_km 
            FROM customers 
            HAVING distance_km <= ? 
            ORDER BY distance_km ASC
        `;
        const [rows] = await dbconnect_1.conn.query(sql, [shopLng, shopLat, distanceKm]);
        res.json(rows);
    }
    catch (error) {
        console.error("Error fetching nearby customers:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.get("/search", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM customers WHERE (id IS NULL OR id = ?) OR (name IS NULL OR name LIKE ?)", [req.query.id, "%" + req.query.name + "%"]);
        res.json(rows);
    }
    catch (error) {
        // ดักจับ Error กรณีทำงานผิดพลาด เพื่อไม่ให้ระบบหลังบ้านพังล่มไปดื้อๆ
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.get("/:id", async (req, res) => {
    // ใช้เครื่องหมาย ? (Placeholder) เสมอ เพื่อส่งตัวแปรไปแทนค่าในคำสั่ง SQL ป้องกันภัยความปลอดภัย SQL Injection
    const [rows] = await dbconnect_1.conn.query("SELECT * FROM customers WHERE id = ?", [
        req.params.id,
    ]);
    res.json(rows);
});
exports.router.post("/", async (req, res) => {
    try {
        let customer = req.body;
        console.log(req.body);
        let sql = "INSERT INTO `customers`(`name`, `phone`, `address`, `latitude`, `longitude`) VALUES (?,?,?,?,?)";
        const [result] = await dbconnect_1.conn.query(sql, [
            customer.name,
            customer.phone,
            customer.address,
            customer.latitude,
            customer.longitude,
        ]);
        // แปลงผลลัพธ์เพื่อนำมาสกัดหาข้อมูลแถวที่ทำรายการสำเร็จ
        const insertResult = result;
        res.status(201).json({
            affected_row: insertResult.affectedRows, // จำนวนแถวที่ได้รับผลกระทบ (สำเร็จ = 1)
            last_idx: insertResult.insertId // รหัสไอดีล่าสุดที่ระบบสร้างขึ้นให้อัตโนมัติ (Auto increment id)
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.delete("/:id", async (req, res) => {
    try {
        let id = req.params.id;
        const [result] = await dbconnect_1.conn.query("DELETE FROM customers WHERE id = ?", [id]);
        const deleteResult = result;
        // ตรวจเช็กสักนิดว่ามีแถวถูกลบจริงไหม หากไม่มีแสดงว่าไม่พบไอดีในฐานข้อมูล ส่งกลับรหัส 404
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }
        res.status(200).json({ affected_row: deleteResult.affectedRows });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.put("/:id", async (req, res) => {
    try {
        let id = req.params.id;
        let customer = req.body;
        let sql = "UPDATE `customers` SET `name`=?, `phone`=?, `address`=?, `latitude`=?, `longitude`=? WHERE `id`=?";
        const [result] = await dbconnect_1.conn.query(sql, [
            customer.name,
            customer.phone,
            customer.address,
            customer.latitude,
            customer.longitude,
            id,
        ]);
        const updateResult = result;
        // หากไม่พบไอดีที่จะอัปเดต ส่งรหัส 404 กลับทันที
        if (updateResult.affectedRows === 0) {
            return res.status(404).json({ error: "Customer not found" });
        }
        res.status(200).json({ affected_row: updateResult.affectedRows });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.patch("/:id", async (req, res) => {
    let id = +req.params.id; // แปลง id จากข้อความตัวอักษรให้เป็นตัวเลขด้วยสัญลักษณ์ + ข้างหน้า
    let customer = req.body;
    // 1. ค้นหาข้อมูลเก่าจากไอดีที่ต้องการอัปเดตก่อน
    let sql = mysql2_1.default.format("SELECT * FROM customers WHERE id = ?", [id]);
    let [response] = await dbconnect_1.conn.query(sql);
    let result = response;
    if (result.length > 0) {
        let customerOriginal = result[0];
        // 2. นำข้อมูลเก่ามาทับด้วยข้อมูลใหม่ที่ส่งมา (ค่าไหนไม่ส่งมาก็จะใช้ค่าเก่าของเดิม)
        let updateCustomer = { ...customerOriginal, ...customer };
        // 3. เขียนข้อมูลที่รวมสำเร็จแล้วกลับลงไปในฐานข้อมูล
        sql =
            "UPDATE `customers` SET `name`=?, `phone`=?, `address`=?, `latitude`=?, `longitude`=? WHERE `id`=?";
        sql = mysql2_1.default.format(sql, [
            updateCustomer.name,
            updateCustomer.phone,
            updateCustomer.address,
            updateCustomer.latitude,
            updateCustomer.longitude,
            id,
        ]);
        const [records] = await dbconnect_1.conn.query(sql);
        const updateResult = records;
        res.status(200).json({ affected_row: updateResult.affectedRows });
    }
    else {
        res.status(404).json({ message: "Customer not found" });
    }
});
//# sourceMappingURL=customers.js.map