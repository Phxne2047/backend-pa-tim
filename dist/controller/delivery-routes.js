"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../dbconnect");
const shop_1 = require("../config/shop");
exports.router = express_1.default.Router();
// ==========================================
// 1. ฟังก์ชันคำนวณระยะทาง (Haversine Formula)
// คำนวณระยะทางระหว่างจุด 2 จุดจากพิกัด Lat, Lng (กิโลเมตร)
// ==========================================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีของโลก (กม.)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDist = R * c;
    // คูณ 1.35 เพื่อชดเชยระยะทางโค้งตามถนนจริง
    return Number((straightDist * 1.35).toFixed(2));
}
// คำนวณเวลาเดินทาง (นาที) อิงจากมอเตอร์ไซค์ขับ 30 กม./ชม. (1 กม. = 2 นาที)
function calculateDuration(distanceKm) {
    return Number((distanceKm * 2).toFixed(1));
}
// ==========================================
// 2. ฟังก์ชันจัดกลุ่มออเดอร์ให้ไรเดอร์ (Nearest Neighbor Clustered)
// เงื่อนไข: 1 ไรเดอร์ รับไม่เกิน 3 ออเดอร์ และไม่เกิน 10 กล่อง
// ==========================================
function groupOrdersForRiders(orders) {
    // สุ่มสลับออเดอร์ก่อนจัดกลุ่ม เพื่อให้ได้เส้นทางที่แตกต่างกันทุกครั้งที่กดคำนวณใหม่
    let remaining = [...orders].sort(() => Math.random() - 0.5);
    const groups = [];
    while (remaining.length > 0) {
        // หยิบออเดอร์แรกมาเป็นจุดตั้งต้นของกลุ่ม
        const group = [remaining[0]];
        let currentBoxes = Number(remaining[0].boxes);
        let currentLat = Number(remaining[0].latitude);
        let currentLng = Number(remaining[0].longitude);
        remaining.splice(0, 1);
        // วนหาออเดอร์อื่นที่อยู่ใกล้ที่สุดมารวมกลุ่ม (ไม่เกิน 3 ออเดอร์ และรวมกันไม่เกิน 10 กล่อง)
        while (group.length < 3 && remaining.length > 0) {
            let bestIndex = -1;
            let minDistance = Infinity;
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const boxCount = Number(candidate.boxes);
                // เช็คเงื่อนไขกล่องรวมต้องไม่เกิน 10 กล่อง
                if (currentBoxes + boxCount <= 10) {
                    const dist = calculateDistance(currentLat, currentLng, Number(candidate.latitude), Number(candidate.longitude));
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIndex = i;
                    }
                }
            }
            // ถ้าเจอออเดอร์ใกล้เคียงที่รวมได้
            if (bestIndex !== -1) {
                const matched = remaining[bestIndex];
                group.push(matched);
                currentBoxes += Number(matched.boxes);
                currentLat = Number(matched.latitude);
                currentLng = Number(matched.longitude);
                remaining.splice(bestIndex, 1);
            }
            else {
                // ถ้าไม่มีออเดอร์ไหนรวมแล้วไม่เกิน 10 กล่อง ให้จบลูปกลุ่มนี้
                break;
            }
        }
        groups.push(group);
    }
    return groups;
}
// ==========================================
// 3. ฟังก์ชันเรียงลำดับจุดส่งในกลุ่มให้สั้นที่สุด
// (ร้านค้า -> จุดที่ 1 -> จุดที่ 2 -> จุดที่ 3)
// ==========================================
function sortStops(stops, shopLat, shopLng) {
    if (stops.length <= 1)
        return stops;
    // กรณีมี 2 จุด: เปรียบเทียบว่า ร้าน->1->2 หรือ ร้าน->2->1 สั้นกว่ากัน
    if (stops.length === 2) {
        const d1 = calculateDistance(shopLat, shopLng, Number(stops[0].latitude), Number(stops[0].longitude)) +
            calculateDistance(Number(stops[0].latitude), Number(stops[0].longitude), Number(stops[1].latitude), Number(stops[1].longitude));
        const d2 = calculateDistance(shopLat, shopLng, Number(stops[1].latitude), Number(stops[1].longitude)) +
            calculateDistance(Number(stops[1].latitude), Number(stops[1].longitude), Number(stops[0].latitude), Number(stops[0].longitude));
        return d1 <= d2 ? [stops[0], stops[1]] : [stops[1], stops[0]];
    }
    // กรณีมี 3 จุด: ตรวจสอบทั้ง 6 รูปแบบเพื่อหาเส้นทางที่สั้นที่สุด
    const permutations = [
        [0, 1, 2], [0, 2, 1],
        [1, 0, 2], [1, 2, 0],
        [2, 0, 1], [2, 1, 0],
    ];
    let bestStops = [stops[0], stops[1], stops[2]];
    let minDistance = Infinity;
    for (const p of permutations) {
        const idx0 = p[0];
        const idx1 = p[1];
        const idx2 = p[2];
        const s1 = stops[idx0];
        const s2 = stops[idx1];
        const s3 = stops[idx2];
        const totalDist = calculateDistance(shopLat, shopLng, Number(s1.latitude), Number(s1.longitude)) +
            calculateDistance(Number(s1.latitude), Number(s1.longitude), Number(s2.latitude), Number(s2.longitude)) +
            calculateDistance(Number(s2.latitude), Number(s2.longitude), Number(s3.latitude), Number(s3.longitude));
        if (totalDist < minDistance) {
            minDistance = totalDist;
            bestStops = [s1, s2, s3];
        }
    }
    return bestStops;
}
// ==========================================
// API Endpoints
// ==========================================
// ดึงข้อมูลสายส่งทั้งหมด
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM delivery_routes");
        const deliveryRoutes = rows;
        res.json(deliveryRoutes);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// บันทึกสายส่งรายตัว
exports.router.post("/", async (req, res) => {
    try {
        const deliveryRoute = req.body;
        const sql = "INSERT INTO `delivery_routes`(`rider_id`, `job_code`, `total_orders`, `total_boxes`, `total_distance`, `time_delivery`, `delivery_peice`, `net_profit`, `status`) VALUES (?,?,?,?,?,?,?,?,?)";
        const [result] = await dbconnect_1.conn.query(sql, [
            deliveryRoute.rider_id,
            deliveryRoute.job_code,
            deliveryRoute.total_orders,
            deliveryRoute.total_boxes,
            deliveryRoute.total_distance,
            deliveryRoute.time_delivery,
            deliveryRoute.delivery_peice,
            deliveryRoute.net_profit,
            deliveryRoute.status || "pending",
        ]);
        const insertResult = result;
        res.status(201).json({
            affected_row: insertResult.affectedRows,
            last_idx: insertResult.insertId,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
// ==========================================
// POST /delivery-routes/optimize
// คำนวณเส้นทางใหม่: ล้างข้อมูลเดิม -> จัดกลุ่มเส้นทางใหม่ -> บันทึก Database
// ==========================================
exports.router.post("/optimize", async (req, res) => {
    let db;
    try {
        db = await dbconnect_1.conn.getConnection();
        await db.beginTransaction();
        // 1. ล้างข้อมูลเดิมทั้งหมดก่อน เพื่อไม่ให้มีข้อมูลตกค้าง
        await db.query("DELETE FROM route_stops");
        await db.query("DELETE FROM delivery_routes");
        await db.query("UPDATE orders SET status = 'pending'");
        // 2. ดึงออเดอร์ที่พร้อมจัดส่ง
        const [orderRows] = await db.query(`
            SELECT o.id, o.customer_id, o.boxes, o.menu, o.status,
                   c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM orders o
            INNER JOIN customers c ON o.customer_id = c.id
            ORDER BY o.id ASC
            FOR UPDATE
        `);
        const orders = orderRows;
        if (orders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบออเดอร์ที่พร้อมจัดส่งในระบบ" });
        }
        // 3. ดึงไรเดอร์ทั้งหมด
        const [riderRows] = await db.query("SELECT * FROM riders");
        const riders = riderRows;
        if (riders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบข้อมูลไรเดอร์ในระบบ" });
        }
        // 4. จัดกลุ่มออเดอร์ (แต่ละกลุ่มไม่เกิน 3 ออเดอร์ และไม่เกิน 10 กล่อง)
        // เมื่อกดแต่ละครั้ง การสุ่มลำดับตั้งต้นจะทำให้กลุ่มเส้นทางและระยะทางเปลี่ยนไปอย่างชัดเจน
        const groups = groupOrdersForRiders(orders);
        // สุ่มสลับไรเดอร์เพื่อกระจายงาน
        const shuffledRiders = [...riders].sort(() => Math.random() - 0.5);
        const shopLat = shop_1.SHOP_CONFIG.latitude;
        const shopLng = shop_1.SHOP_CONFIG.longitude;
        const createdRoutes = [];
        let totalAllBoxes = 0;
        let totalAllOrders = 0;
        let totalAllDeliveryCost = 0;
        let maxDeliveryTime = 0;
        // 5. วนลูปสร้างแต่ละสายส่ง และบันทึกลง Database
        for (let i = 0; i < groups.length; i++) {
            const rawGroup = groups[i];
            const rider = shuffledRiders[i % shuffledRiders.length];
            const jobCode = `JOB-${String(i + 1).padStart(2, "0")}`;
            // จัดเรียงลำดับจุดส่งให้สั้นที่สุด
            const sortedGroup = sortStops(rawGroup, shopLat, shopLng);
            let totalGroupBoxes = 0;
            let totalGroupDistance = 0;
            let cumulativeTime = 0;
            const stopsData = [];
            let previousLat = shopLat;
            let previousLng = shopLng;
            for (let j = 0; j < sortedGroup.length; j++) {
                const order = sortedGroup[j];
                const boxCount = Number(order.boxes);
                totalGroupBoxes += boxCount;
                const curLat = Number(order.latitude);
                const curLng = Number(order.longitude);
                // คำนวณระยะทางจากจุดก่อนหน้า
                const dist = calculateDistance(previousLat, previousLng, curLat, curLng);
                const timeThisLeg = calculateDuration(dist);
                totalGroupDistance += dist;
                cumulativeTime += timeThisLeg;
                stopsData.push({
                    order: order,
                    stop_number: j + 1,
                    distance_before: dist,
                    total_time: Number(cumulativeTime.toFixed(1)),
                });
                previousLat = curLat;
                previousLng = curLng;
            }
            totalGroupDistance = Number(totalGroupDistance.toFixed(2));
            const timeDelivery = Number(cumulativeTime.toFixed(1));
            // คำนวณค่าส่ง: 15 บาท + (ระยะทางรวม * 2 บาท * จำนวนกล่อง)
            const deliveryFee = Number((shop_1.SHOP_CONFIG.rider_base_fee + totalGroupDistance * shop_1.SHOP_CONFIG.rider_fee_per_km_box * totalGroupBoxes).toFixed(2));
            // คำนวณกำไรสุทธิ: (กล่องรวม * 25 บาท) - ค่าส่ง
            const netProfit = Number((totalGroupBoxes * (shop_1.SHOP_CONFIG.box_price - shop_1.SHOP_CONFIG.food_cost) - deliveryFee).toFixed(2));
            // บันทึกสายส่งลงตาราง delivery_routes
            const insertRouteSql = `
                INSERT INTO delivery_routes (rider_id, job_code, total_orders, total_boxes, total_distance, time_delivery, delivery_peice, net_profit, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            const [routeResult] = await db.query(insertRouteSql, [
                rider.id,
                jobCode,
                sortedGroup.length,
                totalGroupBoxes,
                totalGroupDistance,
                timeDelivery,
                deliveryFee,
                netProfit,
            ]);
            const routeId = routeResult.insertId;
            // บันทึกจุดส่งลงตาราง route_stops
            const savedStops = [];
            for (const stop of stopsData) {
                const insertStopSql = `
                    INSERT INTO route_stops (route_id, order_id, stop_number, distance_before, total_time, status)
                    VALUES (?, ?, ?, ?, ?, 'pending')
                `;
                const [stopResult] = await db.query(insertStopSql, [
                    routeId,
                    stop.order.id,
                    stop.stop_number,
                    stop.distance_before,
                    stop.total_time,
                ]);
                // อัปเดตสถานะออเดอร์เป็น assigned
                await db.query("UPDATE orders SET status = 'assigned' WHERE id = ?", [stop.order.id]);
                const lat = Number(stop.order.latitude);
                const lng = Number(stop.order.longitude);
                savedStops.push({
                    stop_id: stopResult.insertId,
                    stop_number: stop.stop_number,
                    order_id: stop.order.id,
                    customer_name: stop.order.customer_name,
                    customer_phone: stop.order.customer_phone,
                    address: stop.order.address,
                    boxes: stop.order.boxes,
                    menu: stop.order.menu,
                    latitude: lat,
                    longitude: lng,
                    distance_from_prev_km: stop.distance_before,
                    cumulative_time_min: stop.total_time,
                    google_map_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                    status: "pending",
                });
            }
            totalAllBoxes += totalGroupBoxes;
            totalAllOrders += sortedGroup.length;
            totalAllDeliveryCost += deliveryFee;
            if (timeDelivery > maxDeliveryTime) {
                maxDeliveryTime = timeDelivery;
            }
            createdRoutes.push({
                route_id: routeId,
                job_code: jobCode,
                rider_id: rider.id,
                rider_name: rider.name,
                rider_phone: rider.phone,
                route_color: rider.color,
                total_orders: sortedGroup.length,
                total_boxes: totalGroupBoxes,
                total_distance_km: totalGroupDistance,
                estimated_time_min: timeDelivery,
                delivery_fee: deliveryFee,
                net_profit: netProfit,
                status: "pending",
                stops: savedStops,
            });
        }
        // 6. สรุปข้อมูลสำหรับแผงวิเคราะห์ทางการเงินและเวลา
        const totalRevenue = totalAllBoxes * shop_1.SHOP_CONFIG.box_price;
        const totalFoodCost = totalAllBoxes * shop_1.SHOP_CONFIG.food_cost;
        const totalGrossProfit = totalAllBoxes * (shop_1.SHOP_CONFIG.box_price - shop_1.SHOP_CONFIG.food_cost);
        const totalNetProfit = Number((totalGrossProfit - totalAllDeliveryCost).toFixed(2));
        const dashboard = {
            total_orders: totalAllOrders,
            total_boxes: totalAllBoxes,
            total_riders_used: createdRoutes.length,
            total_revenue: totalRevenue,
            total_food_cost: totalFoodCost,
            total_gross_profit: totalGrossProfit,
            total_delivery_cost: Number(totalAllDeliveryCost.toFixed(2)),
            net_profit: totalNetProfit,
            max_delivery_time_min: maxDeliveryTime,
            is_risk_loss: totalNetProfit < 0,
            is_risk_late: maxDeliveryTime > 60,
        };
        await db.commit();
        res.status(200).json({
            message: "จัดเส้นทางสำเร็จเรียบร้อยแล้ว",
            shop: {
                name: shop_1.SHOP_CONFIG.name,
                address: shop_1.SHOP_CONFIG.address,
                latitude: shopLat,
                longitude: shopLng,
            },
            financial_dashboard: dashboard,
            routes: createdRoutes,
        });
    }
    catch (error) {
        if (db) {
            await db.rollback();
        }
        console.error("Error optimizing routes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
    finally {
        db?.release();
    }
});
// ==========================================
// GET /delivery-routes/all
// ดึงข้อมูลรอบจัดส่งล่าสุดที่บันทึกไว้ใน Database
// ==========================================
exports.router.get("/all", async (req, res) => {
    try {
        const [routeRows] = await dbconnect_1.conn.query(`
            SELECT dr.*, r.name AS rider_name, r.phone AS rider_phone, r.color AS route_color
            FROM delivery_routes dr
            LEFT JOIN riders r ON dr.rider_id = r.id
            ORDER BY dr.id ASC
        `);
        if (routeRows.length === 0) {
            return res.status(200).json({
                shop: {
                    name: shop_1.SHOP_CONFIG.name,
                    address: shop_1.SHOP_CONFIG.address,
                    latitude: shop_1.SHOP_CONFIG.latitude,
                    longitude: shop_1.SHOP_CONFIG.longitude,
                },
                financial_dashboard: null,
                routes: [],
            });
        }
        const [stopRows] = await dbconnect_1.conn.query(`
            SELECT rs.*, o.boxes, o.menu, c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM route_stops rs
            LEFT JOIN orders o ON rs.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            ORDER BY rs.route_id ASC, rs.stop_number ASC
        `);
        let totalAllBoxes = 0;
        let totalAllOrders = 0;
        let totalAllDeliveryCost = 0;
        let maxDeliveryTime = 0;
        const routes = routeRows.map((route) => {
            const stops = stopRows
                .filter((s) => s.route_id === route.id)
                .map((s) => {
                const lat = Number(s.latitude);
                const lng = Number(s.longitude);
                return {
                    stop_id: s.id,
                    stop_number: s.stop_number,
                    order_id: s.order_id,
                    customer_name: s.customer_name,
                    customer_phone: s.customer_phone,
                    address: s.address,
                    boxes: s.boxes,
                    menu: s.menu,
                    latitude: lat,
                    longitude: lng,
                    distance_from_prev_km: Number(s.distance_before),
                    cumulative_time_min: Number(s.total_time),
                    google_map_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
                    status: s.status,
                };
            });
            const boxes = Number(route.total_boxes);
            const deliveryFee = Number(route.delivery_peice);
            const timeDelivery = Number(route.time_delivery);
            totalAllBoxes += boxes;
            totalAllOrders += Number(route.total_orders);
            totalAllDeliveryCost += deliveryFee;
            if (timeDelivery > maxDeliveryTime) {
                maxDeliveryTime = timeDelivery;
            }
            return {
                route_id: route.id,
                job_code: route.job_code,
                rider_id: route.rider_id,
                rider_name: route.rider_name,
                rider_phone: route.rider_phone,
                route_color: route.route_color,
                total_orders: route.total_orders,
                total_boxes: boxes,
                total_distance_km: Number(route.total_distance),
                estimated_time_min: timeDelivery,
                delivery_fee: deliveryFee,
                net_profit: Number(route.net_profit),
                status: route.status,
                stops: stops,
            };
        });
        const totalRevenue = totalAllBoxes * shop_1.SHOP_CONFIG.box_price;
        const totalFoodCost = totalAllBoxes * shop_1.SHOP_CONFIG.food_cost;
        const totalGrossProfit = totalAllBoxes * (shop_1.SHOP_CONFIG.box_price - shop_1.SHOP_CONFIG.food_cost);
        const totalNetProfit = Number((totalGrossProfit - totalAllDeliveryCost).toFixed(2));
        const dashboard = {
            total_orders: totalAllOrders,
            total_boxes: totalAllBoxes,
            total_riders_used: routes.length,
            total_revenue: totalRevenue,
            total_food_cost: totalFoodCost,
            total_gross_profit: totalGrossProfit,
            total_delivery_cost: Number(totalAllDeliveryCost.toFixed(2)),
            net_profit: totalNetProfit,
            max_delivery_time_min: maxDeliveryTime,
            is_risk_loss: totalNetProfit < 0,
            is_risk_late: maxDeliveryTime > 60,
        };
        res.status(200).json({
            shop: {
                name: shop_1.SHOP_CONFIG.name,
                address: shop_1.SHOP_CONFIG.address,
                latitude: shop_1.SHOP_CONFIG.latitude,
                longitude: shop_1.SHOP_CONFIG.longitude,
            },
            financial_dashboard: dashboard,
            routes: routes,
        });
    }
    catch (error) {
        console.error("Error fetching latest routes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ==========================================
// GET /delivery-routes/job/:jobCode
// ดึงข้อมูลใบงานสำหรับไรเดอร์ดูผ่านมือถือ
// ==========================================
exports.router.get("/job/:jobCode", async (req, res) => {
    try {
        const jobCode = req.params.jobCode;
        const [routeRows] = await dbconnect_1.conn.query(`
            SELECT dr.*, r.name AS rider_name, r.phone AS rider_phone
            FROM delivery_routes dr
            LEFT JOIN riders r ON dr.rider_id = r.id
            WHERE dr.job_code = ?
        `, [jobCode]);
        if (routeRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบใบงานตามรหัสที่ระบุ" });
        }
        const route = routeRows[0];
        const [stopRows] = await dbconnect_1.conn.query(`
            SELECT rs.*, o.boxes, o.menu, c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM route_stops rs
            LEFT JOIN orders o ON rs.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE rs.route_id = ?
            ORDER BY rs.stop_number ASC
        `, [route.id]);
        const stops = stopRows.map((s) => {
            const lat = Number(s.latitude);
            const lng = Number(s.longitude);
            return {
                step: s.stop_number,
                stop_id: s.id,
                order_id: s.order_id,
                customer_name: s.customer_name,
                customer_phone: s.customer_phone,
                address: s.address,
                boxes: s.boxes,
                menu: s.menu,
                latitude: lat,
                longitude: lng,
                status: s.status,
                distance_before: Number(s.distance_before),
                total_time: Number(s.total_time),
                google_maps_nav_url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
            };
        });
        res.status(200).json({
            job_code: route.job_code,
            rider_name: route.rider_name,
            rider_phone: route.rider_phone,
            status: route.status,
            pickup_summary: {
                total_boxes_to_pickup: route.total_boxes,
                total_stops: route.total_orders,
                total_distance_km: Number(route.total_distance),
                estimated_time_min: Number(route.time_delivery),
                expected_earnings_baht: Number(route.delivery_peice),
            },
            delivery_sequence: stops,
        });
    }
    catch (error) {
        console.error("Error fetching job details:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ==========================================
// PATCH /delivery-routes/stops/:stopId/status
// ไรเดอร์อัปเดตสถานะส่งสำเร็จ
// ==========================================
exports.router.patch("/stops/:stopId/status", async (req, res) => {
    try {
        const stopId = parseInt(req.params.stopId, 10);
        const { status } = req.body;
        const newStatus = status || "delivered";
        const [stopRows] = await dbconnect_1.conn.query("SELECT * FROM route_stops WHERE id = ?", [stopId]);
        if (stopRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลจุดส่งนี้" });
        }
        const stop = stopRows[0];
        await dbconnect_1.conn.query("UPDATE route_stops SET status = ?, delivered_at = NOW() WHERE id = ?", [newStatus, stopId]);
        await dbconnect_1.conn.query("UPDATE orders SET status = ? WHERE id = ?", [newStatus, stop.order_id]);
        const [allStops] = await dbconnect_1.conn.query("SELECT status FROM route_stops WHERE route_id = ?", [stop.route_id]);
        const allDelivered = allStops.every((s) => s.status === "delivered");
        if (allDelivered) {
            await dbconnect_1.conn.query("UPDATE delivery_routes SET status = 'completed' WHERE id = ?", [stop.route_id]);
        }
        res.status(200).json({
            message: "อัปเดตสถานะจัดส่งสำเร็จ",
            stop_id: stopId,
            status: newStatus,
            all_route_completed: allDelivered,
        });
    }
    catch (error) {
        console.error("Error updating stop status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ==========================================
// DELETE /delivery-routes/all
// ล้างข้อมูลรอบจัดส่งทั้งหมด
// ==========================================
exports.router.delete("/all", async (req, res) => {
    try {
        await dbconnect_1.conn.query("DELETE FROM route_stops");
        await dbconnect_1.conn.query("DELETE FROM delivery_routes");
        await dbconnect_1.conn.query("UPDATE orders SET status = 'pending' WHERE status = 'assigned'");
        res.status(200).json({ message: "รีเซ็ตรอบจัดส่งเรียบร้อยแล้ว" });
    }
    catch (error) {
        console.error("Error resetting delivery routes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
//# sourceMappingURL=delivery-routes.js.map