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
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";
const matrixCache = new Map();
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c * 1.35).toFixed(2));
}
function generateFallbackMatrix(coordinates) {
    const n = coordinates.length;
    const distances = [];
    const durations = [];
    for (let i = 0; i < n; i++) {
        distances[i] = [];
        durations[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                distances[i][j] = 0;
                durations[i][j] = 0;
            }
            else {
                const dist = calculateHaversineDistance(coordinates[i].lat, coordinates[i].lng, coordinates[j].lat, coordinates[j].lng);
                distances[i][j] = dist;
                durations[i][j] = Number((dist * 2).toFixed(1));
            }
        }
    }
    return { distances, durations };
}
async function fetchDistanceMatrix(coordinates) {
    const coordKey = coordinates.map((c) => `${c.lng.toFixed(5)},${c.lat.toFixed(5)}`).join(";");
    if (matrixCache.has(coordKey)) {
        return matrixCache.get(coordKey);
    }
    const coordString = coordinates.map((c) => `${c.lng},${c.lat}`).join(";");
    const url = `${OSRM_BASE_URL}/table/v1/driving/${coordString}?annotations=distance,duration`;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        const data = await res.json();
        if (data.code === "Ok" && data.distances && data.durations) {
            const matrix = {
                distances: data.distances.map((row) => row.map((d) => Number((d / 1000).toFixed(2)))),
                durations: data.durations.map((row) => row.map((d) => Number((d / 60).toFixed(1)))),
            };
            matrixCache.set(coordKey, matrix);
            return matrix;
        }
    }
    catch (err) {
        console.warn("OSRM table request failed or timed out, using road estimate fallback:", err);
    }
    const fallback = generateFallbackMatrix(coordinates);
    matrixCache.set(coordKey, fallback);
    return fallback;
}
//จัดกลุ่มออเดอร์ด้วย Knapsack + OSRM Distance Matrix พร้อมรองรับการสร้างทางเลือกใหม่ๆ เมื่อกดคำนวณซ้ำ
function groupOrdersKnapsack(orders, distMatrix) {
    // สุ่มจัดลำดับออเดอร์ที่มีกล่องเท่ากัน เพื่อเปิดโอกาสให้ระบบสร้างทางเลือกใหม่ๆ ทุกครั้งที่กดคำนวณใหม่
    let unassigned = [...orders].sort((a, b) => {
        if (b.boxes !== a.boxes) {
            return b.boxes - a.boxes;
        }
        return Math.random() - 0.5;
    });
    const groups = [];
    while (unassigned.length > 0) {
        // สุ่มเลือก seed จาก 2 ออเดอร์แรกที่มีขนาดกล่องใหญ่ เพื่อกระจายทางเลือก
        const seedIdx = Math.min(Math.floor(Math.random() * 2), unassigned.length - 1);
        const seed = unassigned[seedIdx];
        const remaining = unassigned.filter((_, idx) => idx !== seedIdx);
        const candidates = [];
        // ทางเลือก: ส่งเดี่ยว 1 ออเดอร์
        candidates.push({ subset: [], totalB: seed.boxes, dist: 0 });
        // เพิ่ม 1 ออเดอร์ (รวมเป็น 2 ออเดอร์)
        for (let i = 0; i < remaining.length; i++) {
            const item1 = remaining[i];
            const totalB = seed.boxes + item1.boxes;
            if (totalB <= 10) {
                const d = distMatrix.distances[seed._matrixIdx][item1._matrixIdx];
                candidates.push({ subset: [item1], totalB, dist: d });
            }
        }
        // เพิ่ม 2 ออเดอร์ (รวมเป็น 3 ออเดอร์ สูงสุดตามกฎไรเดอร์รับไม่เกิน 3 ออเดอร์)
        for (let i = 0; i < remaining.length; i++) {
            for (let j = i + 1; j < remaining.length; j++) {
                const item1 = remaining[i];
                const item2 = remaining[j];
                const totalB = seed.boxes + item1.boxes + item2.boxes;
                if (totalB <= 10) {
                    const d = distMatrix.distances[seed._matrixIdx][item1._matrixIdx] +
                        distMatrix.distances[seed._matrixIdx][item2._matrixIdx] +
                        distMatrix.distances[item1._matrixIdx][item2._matrixIdx];
                    candidates.push({ subset: [item1, item2], totalB, dist: d });
                }
            }
        }
        // เรียงลำดับ candidates:
        // 1. บรรจุกล่องได้มากที่สุดก่อน (Knapsack)
        // 2. ระยะทางรวมสั้นที่สุด
        candidates.sort((a, b) => b.totalB - a.totalB || a.dist - b.dist);
        // คัดกรองตัวเลือกที่มีกล่องสูงสุด และเลือกจาก top 2 ตัวเลือกที่ดีที่สุดแบบ stochastic
        const maxBoxes = candidates[0].totalB;
        const topCandidates = candidates.filter((c) => c.totalB === maxBoxes);
        const bestChoices = topCandidates.slice(0, 2);
        const chosen = bestChoices[Math.floor(Math.random() * bestChoices.length)];
        const currentGroup = [seed, ...chosen.subset];
        groups.push(currentGroup);
        const chosenIds = new Set(currentGroup.map((o) => o.id));
        unassigned = unassigned.filter((o) => !chosenIds.has(o.id));
    }
    return groups;
}
//สลับลำดับจุดส่งในกลุ่มให้สั้นที่สุด
function getPermutations(arr) {
    if (arr.length <= 1)
        return [arr];
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const current = arr[i];
        const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
        for (const p of getPermutations(remaining)) {
            result.push([current, ...p]);
        }
    }
    return result;
}
function findOptimalRoute(group, distMatrix, shopIdx) {
    if (group.length <= 1)
        return group;
    const allPermutations = getPermutations(group);
    let bestPermutation = group;
    let minTotalDist = Infinity;
    for (const perm of allPermutations) {
        let totalDist = 0;
        let prevIdx = shopIdx;
        for (const ord of perm) {
            totalDist += distMatrix.distances[prevIdx][ord._matrixIdx];
            prevIdx = ord._matrixIdx;
        }
        if (totalDist < minTotalDist) {
            minTotalDist = totalDist;
            bestPermutation = perm;
        }
    }
    return bestPermutation;
}
exports.router.get("/", async (req, res) => {
    try {
        const [rows] = await dbconnect_1.conn.query("SELECT * FROM delivery_routes");
        let deliveryRoutes = rows;
        res.json(deliveryRoutes);
    }
    catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.router.post("/", async (req, res) => {
    try {
        let deliveryRoute = req.body;
        let sql = "INSERT INTO `delivery_routes`(`rider_id`, `job_code`, `total_orders`, `total_boxes`, `total_distance`, `time_delivery`, `delivery_peice`, `net_profit`, `status`) VALUES (?,?,?,?,?,?,?,?,?)";
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
exports.router.post("/optimize", async (req, res) => {
    let db;
    try {
        db = await dbconnect_1.conn.getConnection();
        await db.beginTransaction();
        // 1. รีเซ็ตข้อมูลเดิมทั้งหมดเพื่อให้สามารถคำนวณใหม่ได้เรื่อยๆ โดยไม่ติด Foreign key หรือ status
        await db.query(`
            DELETE rs
            FROM route_stops rs
            INNER JOIN delivery_routes dr ON dr.id = rs.route_id
        `);
        await db.query("DELETE FROM delivery_routes");
        await db.query("UPDATE orders SET status = 'pending' WHERE status = 'assigned'");
        const shopLat = shop_1.SHOP_CONFIG.latitude;
        const shopLng = shop_1.SHOP_CONFIG.longitude;
        const [orderRows] = await db.query(`
            SELECT o.id, o.customer_id, o.boxes, o.menu, o.status,
                   c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM orders o
            INNER JOIN customers c ON o.customer_id = c.id
            WHERE o.status IN ('pending', 'assigned')
            ORDER BY o.id ASC
            FOR UPDATE
        `);
        const orders = orderRows;
        if (orders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบออเดอร์ที่พร้อมจัดส่งในระบบ" });
        }
        const [riderRows] = await db.query("SELECT * FROM riders");
        const riders = riderRows;
        if (riders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบข้อมูลไรเดอร์ในระบบ" });
        }
        // สร้างพิกัดสำหรับ Distance Matrix: [ร้านค้า, ออเดอร์1, ออเดอร์2, ...]
        const coordinates = [
            { lat: shopLat, lng: shopLng },
            ...orders.map((o) => ({ lat: Number(o.latitude), lng: Number(o.longitude) }))
        ];
        const matrix = await fetchDistanceMatrix(coordinates);
        // กำหนด index ของแต่ละออเดอร์ใน distance matrix (ร้านค้า = index 0)
        orders.forEach((o, idx) => { o._matrixIdx = idx + 1; });
        // ขั้นที่ 1: จัดกลุ่มออเดอร์ (Knapsack + Distance Matrix พร้อม random exploration)
        const groups = groupOrdersKnapsack(orders, matrix);
        // สุ่มสลับลำดับไรเดอร์เพื่อให้ไรเดอร์แต่ละคนสลับงานในแต่ละรอบที่กดคำนวณใหม่
        const shuffledRiders = [...riders].sort(() => Math.random() - 0.5);
        const createdRoutes = [];
        let totalAllBoxes = 0;
        let totalAllOrders = 0;
        let totalAllDeliveryCost = 0;
        let maxDeliveryTime = 0;
        const allAssignedOrderIds = [];
        // ขั้นที่ 2: วิ่งหาลำดับส่งที่ดีที่สุดสำหรับแต่ละกลุ่ม และสร้างเส้นทาง
        for (let i = 0; i < groups.length; i++) {
            const group = groups[i];
            const rider = shuffledRiders[i % shuffledRiders.length];
            const jobCode = `JOB-${String(i + 1).padStart(2, "0")}`;
            // หาเส้นทางที่สั้นที่สุดในกลุ่ม (TSP: 3! = 6 รูปแบบ)
            const optimalStops = findOptimalRoute(group, matrix, 0);
            let totalGroupBoxes = 0;
            let totalGroupDistance = 0;
            let cumulativeTime = 0;
            const stopsData = [];
            for (let j = 0; j < optimalStops.length; j++) {
                const ord = optimalStops[j];
                totalGroupBoxes += ord.boxes;
                const prevIdx = j === 0 ? 0 : optimalStops[j - 1]._matrixIdx;
                const dist = matrix.distances[prevIdx][ord._matrixIdx];
                const timeForThisLeg = matrix.durations[prevIdx][ord._matrixIdx];
                totalGroupDistance += dist;
                cumulativeTime += timeForThisLeg;
                stopsData.push({
                    order: ord,
                    stop_number: j + 1,
                    distance_before: dist,
                    total_time: Number(cumulativeTime.toFixed(1)),
                });
            }
            totalGroupDistance = Number(totalGroupDistance.toFixed(2));
            const timeDelivery = Number(cumulativeTime.toFixed(1));
            const deliveryFee = Number((shop_1.SHOP_CONFIG.rider_base_fee + totalGroupDistance * shop_1.SHOP_CONFIG.rider_fee_per_km_box * totalGroupBoxes).toFixed(2));
            const netProfit = Number((totalGroupBoxes * (shop_1.SHOP_CONFIG.box_price - shop_1.SHOP_CONFIG.food_cost) - deliveryFee).toFixed(2));
            const insertRouteSql = `
                INSERT INTO delivery_routes (rider_id, job_code, total_orders, total_boxes, total_distance, time_delivery, delivery_peice, net_profit, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            const [routeResult] = await db.query(insertRouteSql, [
                rider.id,
                jobCode,
                optimalStops.length,
                totalGroupBoxes,
                totalGroupDistance,
                timeDelivery,
                deliveryFee,
                netProfit,
            ]);
            const routeId = routeResult.insertId;
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
            totalAllOrders += group.length;
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
                total_orders: group.length,
                total_boxes: totalGroupBoxes,
                total_distance_km: totalGroupDistance,
                estimated_time_min: timeDelivery,
                delivery_fee: deliveryFee,
                net_profit: netProfit,
                status: "pending",
                stops: savedStops,
            });
        }
        //แดชบอรืด
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