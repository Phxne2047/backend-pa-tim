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

// USE
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
        const distanceKm = req.query.km ? parseFloat(req.query.km as string) : 3.0;
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

//USE
router.post("/mock", async (req, res) => {
    try {
        let body: OrderMockRequests = req.body || {};
        let count = Math.floor(Math.random() * 11) + 20;
        const clearExisting = body.clear_existing !== undefined ? body.clear_existing : true;

        const shopLat = SHOP_CONFIG.latitude;
        const shopLng = SHOP_CONFIG.longitude;

        const sqlCustomers = `
            SELECT *, 
            ROUND((ST_Distance_Sphere(point(longitude, latitude), point(?, ?)) / 1000), 2) AS distance_km 
            FROM customers 
            HAVING distance_km <= 3.0
        `;
        const [customerRows]: any = await conn.query(sqlCustomers, [shopLng, shopLat]);
        const customers: Customer[] = customerRows;
        if (customers.length === 0) {
            return res.status(400).json({
                error: "ไม่พบลูกค้าที่อยู่ในรัศมี 3 กิโลเมตรสำหรับจำลองออเดอร์",
            });
        }
        if (clearExisting) {
            await conn.query("SET FOREIGN_KEY_CHECKS = 0;");
            await conn.query("DELETE FROM route_stops;");
            await conn.query("DELETE FROM orders;");
            await conn.query("ALTER TABLE orders AUTO_INCREMENT = 1;");
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
            message: `Successfully simulated ${createdOrders.length} orders within 3 km.`,
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


//USE
router.post("/", async (req, res) => {
    try {
        let order: OrdersPostRequests = req.body;
        const boxesToAdd = Number(order.boxes) || 1;
        if (boxesToAdd > 3 || boxesToAdd < 1) {
            return res.status(400).json({ error: "จำนวนกล่องต้องอยู่ระหว่าง 1 ถึง 3 กล่อง" });
        }

        const [existingRows]: any = await conn.query(
            "SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC LIMIT 1",
            [order.customer_id]
        );

        if (existingRows && existingRows.length > 0) {
            const existingOrder = existingRows[0];
            const totalBoxes = existingOrder.boxes + boxesToAdd;

            if (totalBoxes > 3) {
                return res.status(400).json({
                    error: `ลูกค้ารายนี้มีออร์เดอร์อยู่แล้ว ${existingOrder.boxes} กล่อง สั่งเพิ่มอีก ${boxesToAdd} กล่องไม่ได้ (รวมเกิน 3 กล่อง)`
                });
            }

            const updateSql = "UPDATE orders SET boxes = ?, menu = ? WHERE id = ?";
            await conn.query(updateSql, [totalBoxes, order.menu || existingOrder.menu, existingOrder.id]);
            return res.status(200).json({
                message: "อัปเดตออร์เดอร์เดิมของลูกค้าสำเร็จ",
                order_id: existingOrder.id,
                total_boxes: totalBoxes,
                affected_row: 1,
                is_updated: true
            });
        }

        const insertSql =
            "INSERT INTO `orders`(`customer_id`, `boxes`, `status`, `menu`) VALUES (?,?,?,?)";
        const [result]: any = await conn.query(insertSql, [
            order.customer_id,
            boxesToAdd,
            order.status || 'pending',
            order.menu,
        ]);
        res.status(201).json({
            message: "สร้างออร์เดอร์ใหม่สำเร็จ",
            affected_row: result.affectedRows,
            last_idx: result.insertId,
            is_updated: false
        });
    } catch (error) {
        console.error("Error creating/updating order:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete("/all", async (req, res) => {
    try {
        await conn.query("DELETE FROM route_stops");
        const [result] = await conn.query("DELETE FROM orders");
        
        await conn.query("ALTER TABLE orders AUTO_INCREMENT = 1;");
        const deleteResult = result as any;

        if (deleteResult.affectedRows === 0) {
            return res.status(404).json({ error: "No orders found" });
        }
        res.status(200).json({ affected_row: deleteResult.affectedRows });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

//USE
router.delete("/:id", async (req, res) => {
    try {
        let id = req.params.id

        await conn.query("DELETE FROM route_stops WHERE order_id = ?", [id]);
        const [result] = await conn.query("DELETE FROM orders WHERE id = ?", [id]);
        const deleteResult = result as any;


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
        let order: Orders = req.body;
        const [existingRows]: any = await conn.query("SELECT * FROM orders WHERE id = ?", [id]);
        if (!existingRows || existingRows.length === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        if (order.boxes !== undefined && (order.boxes > 3 || order.boxes < 1)) {
            return res.status(400).json({ error: "จำนวนกล่องต้องอยู่ระหว่าง 1 ถึง 3 กล่องเท่านั้น" });
        }
        const existingOrder: Orders = existingRows[0];

        const updatedCustomerId = order.customer_id !== undefined ? order.customer_id : existingOrder.customer_id;
        const updatedBoxes = order.boxes !== undefined ? order.boxes : existingOrder.boxes;
        const updatedStatus = order.status !== undefined ? order.status : existingOrder.status;
        const updatedMenu = order.menu !== undefined ? order.menu : existingOrder.menu;

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

//USE
router.patch("/:id", async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const order: Orders = req.body;

        if (order.boxes !== undefined && (order.boxes > 3 || order.boxes < 1)) {
            return res.status(400).json({ error: "จำนวนกล่องต้องอยู่ระหว่าง 1 ถึง 3 กล่องเท่านั้น" });
        }

        let sql = mysql.format("SELECT * FROM orders WHERE id = ?", [id]);
        let [response] = await conn.query(sql);
        let result = response as Orders[];

        if (result.length > 0) {
            let OrdersOriginal = result[0];

            let updateOrders = { ...OrdersOriginal, ...order };

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
