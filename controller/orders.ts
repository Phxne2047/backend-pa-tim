import express from "express";
import mysql from "mysql2";
import { conn } from "../dbconnect";
import { SHOP_CONFIG } from "../config/shop";
import { Orders, OrderMockRequests, OrdersPostRequests } from "../model/orders";
import { Customer } from "../model/customers";

export const router = express.Router();

// รายการเมนูอาหารสำหรับจำลองออเดอร์
const MENUS = [
    "ข้าวกะเพราหมูกรอบไข่ดาว",
    "ข้าวผัดพริกแกงหมูกรอบ",
    "ข้าวกะเพราไก่ไข่ดาว",
    "ข้าวคะน้าหมูกรอบ",
    "ข้าวไข่เจียวหมูสับทรงเครื่อง",
    "ข้าวผัดต้มยำทะเล",
    "ข้าวกะเพราหมูสับไข่เค็ม",
    "ข้าวหมูกระเทียมพริกไทย",
    "ข้าวกะเพราทะเลรวมมิตร",
    "ข้าวผัดกุนเชียงใส่ไข่",
    "ข้าวพริกเผาหมูกรอบ",
    "ข้าวกะเพราหมูสับไข่ดาว",
    "ข้าวผัดหมูใส่ไข่",
    "ข้าวหมูกระเทียมไข่ดาว",
    "ข้าวผัดต้มยำกุ้ง",
    "ข้าวคะน้าปลากระป๋อง",
    "ข้าวกะเพราไก่สับ",
    "ข้าวผัดพริกแกงทะเล",
    "ข้าวกะเพราไข่เยี่ยวม้าหมูสับ",
    "ข้าวไข่เจียวหมูกรอบ",
    "ข้าวพริกแกงหมูใส่ถั่ว",
];

//use
router.get("/", async (req, res) => {
    const shopLat = SHOP_CONFIG.latitude
    const shopLng = SHOP_CONFIG.longitude
    let sql = `SELECT o.*,c.name,c.phone,c.address,c.latitude,c.longitude,
    ROUND((ST_Distance_Sphere(point(c.longitude, c.latitude), point(?, ?)) / 1000), 2) AS distance_km
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id`;
    const [rows] = await conn.query(sql, [shopLng, shopLat]);
    res.send(rows);
});

router.get("/near", async (req, res) => {
    try {
        const distanceKm = req.query.km ? parseFloat(req.query.km as string) : 2.0;
        const targetLat = req.query.lat ? parseFloat(req.query.lat as string) : SHOP_CONFIG.latitude;
        const targetLng = req.query.lng ? parseFloat(req.query.lng as string) : SHOP_CONFIG.longitude;


        const sql = `
            SELECT o.*, c.name,c.phone,c.address,c.latitude,c.longitude,    
            ROUND((ST_Distance_Sphere(point(c.longitude, c.latitude), point(?, ?)) / 1000), 2) AS distance_km
            FROM orders o
            INNER JOIN customers c ON o.customer_id = c.id
            HAVING distance_km <= ?
            ORDER BY o.id ASC
        `;

        const [rows]: any = await conn.query(sql, [targetLng, targetLat, distanceKm]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching nearby orders:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const shopLat = SHOP_CONFIG.latitude;
        const shopLng = SHOP_CONFIG.longitude;

        const sql = `
            SELECT o.*, c.name,c.phone,c.address,c.latitude,c.longitude,
            ROUND((ST_Distance_Sphere(point(c.longitude, c.latitude), point(?, ?)) / 1000), 2) AS distance_km
            FROM orders o
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE o.id = ?
        `;

        const [rows]: any = await conn.query(sql, [shopLng, shopLat, req.params.id]);
        res.json(rows);
    } catch (error) {
        console.error("Error fetching order by id:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

//mock
router.post("/mock", async (req, res) => {
    try {
        let body: OrderMockRequests = req.body || {};
        let count = Math.floor(Math.random() * 11) + 20; // 20 - 30 รายการ
        const clearExisting = body.clear_existing !== undefined ? body.clear_existing : true;
        //ดึงรายชื่อลูกค้าที่มีอยู่ในระบบ
        const [customerRows]: any = await conn.query("SELECT * FROM customers");
        const customers: Customer[] = customerRows;

        if (customers.length === 0) {
            return res.status(400).json({
                error: "No customers found in database to simulate orders from.",
            });
        }
        if (clearExisting) {
            // ปิดการตรวจสอบ Foreign Key ชั่วคราว
            await conn.query("SET FOREIGN_KEY_CHECKS = 0;");

            // ใช้ TRUNCATE เพื่อลบข้อมูลและรีเซ็ต ID เริ่มต้นที่ 1 ใหม่
            await conn.query("TRUNCATE TABLE route_stops;");
            await conn.query("TRUNCATE TABLE orders;");

            // เปิดการตรวจสอบ Foreign Key กลับมา
            await conn.query("SET FOREIGN_KEY_CHECKS = 1;");
        }

        const createdOrders: any[] = [];
        const baseTime = new Date();

        const shuffledCustomers = [...customers].sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            const customer = shuffledCustomers[i % shuffledCustomers.length]!;
            const boxes = Math.floor(Math.random() * 3) + 1;
            const menu = MENUS[Math.floor(Math.random() * MENUS.length)] || "ข้าวกะเพราหมูกรอบไข่ดาว";
            const orderTime = new Date(baseTime.getTime() + (i * 60 + Math.floor(Math.random() * 45)) * 1000);
            const status = "pending";
            const insertSql = `
                INSERT INTO orders (customer_id, boxes, status, menu, created_at)
                VALUES (?, ?, ?, ?, ?)
            `;
            const [result]: any = await conn.query(insertSql, [customer.id, boxes, status, menu, orderTime]);

            createdOrders.push({
                id: result.insertId,
                customer_id: customer.id,
                customer_name: customer.name,
                customer_phone: customer.phone,
                customer_address: customer.address,
                boxes,
                menu,
                status,
                created_at: orderTime,
            });
        }
        res.status(201).json({
            message: `Successfully simulated ${createdOrders.length} orders.`,
            count: createdOrders.length,
            orders: createdOrders,
        });
    } catch (error) {
        console.error("Error simulating orders:", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Internal server error",
        });
    }
});

//use
router.post("/", async (req, res) => {
    try {
        let order: OrdersPostRequests = req.body;

        if (order.boxes > 3) {
            return res.status(400).json({ error: "An order cannot contain more than 3 boxes" });
        }

        let sql =
            "INSERT INTO `orders`(`customer_id`, `boxes`, `status`, `menu`) VALUES (?,?,?,?)";

        const [result] = await conn.query(sql, [
            order.customer_id,
            order.boxes,
            order.status,
            order.menu,
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

router.delete("/all", async (req, res) => {
    try {
        await conn.query("DELETE FROM route_stops");
        const [result] = await conn.query("DELETE FROM orders");
        const deleteResult = result as any;

        // ตรวจเช็กสักนิดว่ามีแถวถูกลบจริงไหม หากไม่มีแสดงว่าไม่พบไอดีในฐานข้อมูล ส่งกลับรหัส 404
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "No orders found" });
        }
        res.status(200).json({ affected_row: deleteResult.affectedRows });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

//use
router.delete("/:id", async (req, res) => {
    try {
        let id = req.params.id
        // ลบจาก route_stops ก่อนหากมีอ้างอิงอยู่
        await conn.query("DELETE FROM route_stops WHERE order_id = ?", [id]);
        const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [id]);
        const deleteResult = result as any;

        // ตรวจเช็กสักนิดว่ามีแถวถูกลบจริงไหม หากไม่มีแสดงว่าไม่พบไอดีในฐานข้อมูล ส่งกลับรหัส 404
        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.status(200).json({ affected_row: deleteResult.affectedRows });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);

        // 1. ค้นหาข้อมูลเดิมก่อน เพื่อตรวจว่ามี ID นี้จริงไหม
        const [existingRows]: any = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
        if (!existingRows || existingRows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        const existingOrder: Orders = existingRows[0];
        let order: Orders = req.body;

        // 2. ใช้ค่าใหม่ หรือสำรองด้วยค่าเดิมถ้าไม่ได้ส่งฟิลด์นั้นมา
        const updatedCustomerId = order.customer_id !== undefined ? order.customer_id : existingOrder.customer_id;
        const updatedBoxes = order.boxes !== undefined ? order.boxes : existingOrder.boxes;
        const updatedStatus = order.status !== undefined ? order.status : existingOrder.status;
        const updatedMenu = order.menu !== undefined ? order.menu : existingOrder.menu;

        // 3. ทำการ Update
        let sql =
            "UPDATE `orders` SET `customer_id`=?, `boxes`=?, `status`=?, `menu`=? WHERE `id`=?";

        const [result]: any = await conn.query(sql, [
            updatedCustomerId,
            updatedBoxes,
            updatedStatus,
            updatedMenu,
            id,
        ]);

        res.status(200).json({
            message: "Order updated successfully",
            affected_row: result.affectedRows,
        });
    } catch (error) {
        console.error("UPDATE ERROR:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
});


//use
router.patch("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const order: Orders = req.body;

        // 1. ค้นหาข้อมูลเก่าจากไอดีที่ต้องการอัปเดตก่อน
        let sql = mysql.format("SELECT * FROM orders WHERE id = ?", [id]);
        let [response] = await conn.query(sql);
        let result = response as Orders[];

        if (result.length > 0) {
            let OrdersOriginal = result[0];

            // 2. นำข้อมูลเก่ามาทับด้วยข้อมูลใหม่ที่ส่งมา (ค่าไหนไม่ส่งมาก็จะใช้ค่าเก่าของเดิม)
            let updateOrders = { ...OrdersOriginal, ...order };

            // 3. เขียนข้อมูลที่รวมสำเร็จแล้วกลับลงไปในฐานข้อมูล
            sql =
                "UPDATE `orders` SET `customer_id`=?, `boxes`=?, `status`=?, `menu`=? WHERE `id`=?";
            sql = mysql.format(sql, [
                updateOrders.customer_id,
                updateOrders.boxes,
                updateOrders.status,
                updateOrders.menu,
                id,
            ]);

            const [records] = await conn.query(sql);
            const updateResult = records as any;
            res.status(200).json({
                affected_row: updateResult.affectedRows,
                order: {
                    id: updateOrders.id,
                    customer_id: updateOrders.customer_id,
                    boxes: updateOrders.boxes,
                    menu: updateOrders.menu,
                    status: updateOrders.status,
                }
            });
        } else {
            res.status(404).json({ message: "Order not found" });
        }
    } catch (error) {
        console.error("UPDATE ERROR:", error);
        res.status(500).json({ error: error instanceof Error ? error.message : "Internal server error" });
    }
});
