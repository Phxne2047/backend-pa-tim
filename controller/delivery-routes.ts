import express from "express";
import { PoolConnection } from "mysql2/promise";
import { conn } from "../dbconnect";
import { DeliveryRoute } from "../model/delivery-routes";
import { SHOP_CONFIG } from "../config/shop";

export const router = express.Router();


//OSRM API
async function getOSRMRoute(coordinates: Array<[number, number]>): Promise<{ distanceKm: number; durationMin: number } | null> {
    try {
        const coordString = coordinates.map(c => `${c[1]},${c[0]}`).join(";");
        const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=false`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.code === "Ok" && data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distanceKm: Number((route.distance / 1000).toFixed(2)),
                durationMin: Number((route.duration / 60).toFixed(1)),
            };
        }
        return null;
    } catch (error) {
        console.error("OSRM API Fetch Error:", error);
        return null;
    }
}

//คำนวณระยะทาง ระหว่างจุด 2 จุดจากพิกัด
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // รัศมีของโลก (กม.)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const straightDist = R * c;

    // คูณ 1.35 เพื่อชดเชยระยะทางโค้งตามถนนจริง
    return Number((straightDist * 1.35).toFixed(2));
}

//คำนวณเวลาเดินทาง ขับ 30 กม./ชม. (1 กม. = 2 นาที)
function calculateDuration(distanceKm: number): number {
    return Number((distanceKm * 2).toFixed(1));
}

//จัดกลุ่มออเดอร์ให้ไรเดอร์
function groupOrdersForRiders(orders: any[]): any[][] {
    let remaining = [...orders].sort(() => Math.random() - 0.5);
    const groups: any[][] = [];

    while (remaining.length > 0) {
        const group: any[] = [remaining[0]];
        let currentBoxes = Number(remaining[0].boxes);
        let currentLat = Number(remaining[0].latitude);
        let currentLng = Number(remaining[0].longitude);

        remaining.splice(0, 1);

        while (group.length < 3 && remaining.length > 0) {
            let bestIndex = -1;
            let minDistance = Infinity;

            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                const boxCount = Number(candidate.boxes);

                if (currentBoxes + boxCount <= 10) {
                    const dist = calculateDistance(
                        currentLat,
                        currentLng,
                        Number(candidate.latitude),
                        Number(candidate.longitude)
                    );
                    if (dist < minDistance) {
                        minDistance = dist;
                        bestIndex = i;
                    }
                }
            }

            if (bestIndex !== -1) {
                const matched = remaining[bestIndex];
                group.push(matched);
                currentBoxes += Number(matched.boxes);
                currentLat = Number(matched.latitude);
                currentLng = Number(matched.longitude);
                remaining.splice(bestIndex, 1);
            } else {
                break;
            }
        }

        groups.push(group);
    }

    return groups;
}

function getPermutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];

    for (let i = 0; i < arr.length; i++) {
        const current = arr[i]!;
        const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
        const remainingPerms = getPermutations(remaining);

        for (const perm of remainingPerms) {
            result.push([current, ...perm]);
        }
    }

    return result;
}

//เรียงลำดับจุดส่งในกลุ่มให้สั้นที่สุด
function sortStops(stops: any[], shopLat: number, shopLng: number): any[] {
    if (stops.length <= 1) return stops;

    const allRoutes = getPermutations(stops);
    let bestRoute = stops;
    let minDistance = Infinity;

    for (const route of allRoutes) {
        let totalDist = 0;
        let prevLat = shopLat;
        let prevLng = shopLng;

        for (const stop of route) {
            const curLat = Number(stop.latitude);
            const curLng = Number(stop.longitude);
            totalDist += calculateDistance(prevLat, prevLng, curLat, curLng);
            prevLat = curLat;
            prevLng = curLng;
        }

        if (totalDist < minDistance) {
            minDistance = totalDist;
            bestRoute = route;
        }
    }

    return bestRoute;
}

router.get("/", async (req, res) => {
    try {
        const [rows] = await conn.query("SELECT * FROM delivery_routes");
        const deliveryRoutes = rows as DeliveryRoute[];
        res.json(deliveryRoutes);
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

router.post("/", async (req, res) => {
    try {
        const deliveryRoute: DeliveryRoute = req.body;
        const sql =
            "INSERT INTO `delivery_routes`(`rider_id`, `job_code`, `total_orders`, `total_boxes`, `total_distance`, `time_delivery`, `delivery_peice`, `net_profit`, `status`) VALUES (?,?,?,?,?,?,?,?,?)";

        const [result] = await conn.query(sql, [
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
        const insertResult = result as any;
        res.status(201).json({
            affected_row: insertResult.affectedRows,
            last_idx: insertResult.insertId,
        });
    } catch (error) {
        res.status(500).json({ error: "Internal server error" });
    }
});

//คำนวณเส้นทางใหม่
router.post("/optimize", async (req, res) => {
    let db: PoolConnection | undefined;

    try {
        db = await conn.getConnection();
        await db.beginTransaction();

        await db.query("DELETE FROM route_stops");
        await db.query("DELETE FROM delivery_routes");
        await db.query("UPDATE orders SET status = 'pending'");

        const [orderRows]: any = await db.query(`
            SELECT o.id, o.customer_id, o.boxes, o.menu, o.status,
                   c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM orders o
            INNER JOIN customers c ON o.customer_id = c.id
            ORDER BY o.id ASC
            FOR UPDATE
        `);

        const orders: any[] = orderRows;
        if (orders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบออเดอร์ที่พร้อมจัดส่งในระบบ" });
        }

        const [riderRows]: any = await db.query("SELECT * FROM riders");
        const riders: any[] = riderRows;
        if (riders.length === 0) {
            await db.rollback();
            return res.status(400).json({ error: "ไม่พบข้อมูลไรเดอร์ในระบบ" });
        }

        const groups = groupOrdersForRiders(orders);

        const shuffledRiders = [...riders].sort(() => Math.random() - 0.5);

        const shopLat = SHOP_CONFIG.latitude;
        const shopLng = SHOP_CONFIG.longitude;

        const createdRoutes: any[] = [];
        let totalAllBoxes = 0;
        let totalAllOrders = 0;
        let totalAllDeliveryCost = 0;
        let maxDeliveryTime = 0;

        for (let i = 0; i < groups.length; i++) {
            const rawGroup = groups[i]!;
            const rider = shuffledRiders[i % shuffledRiders.length]!;
            const jobCode = `JOB-${String(i + 1).padStart(2, "0")}`;

            const sortedGroup = sortStops(rawGroup, shopLat, shopLng);

             const routeCoords: Array<[number, number]> = [
                [shopLat, shopLng],
                ...sortedGroup.map((order: any) => [Number(order.latitude), Number(order.longitude)] as [number, number]),
            ];

            const osrmResult = await getOSRMRoute(routeCoords);

            let totalGroupBoxes = 0;
            let totalGroupDistance = 0;
            let cumulativeTime = 0;
            const stopsData: any[] = [];

            let previousLat = shopLat;
            let previousLng = shopLng;

            for (let j = 0; j < sortedGroup.length; j++) {
                const order = sortedGroup[j];
                const boxCount = Number(order.boxes);
                totalGroupBoxes += boxCount;

                const curLat = Number(order.latitude);
                const curLng = Number(order.longitude);

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

            if (osrmResult) {
                totalGroupDistance = osrmResult.distanceKm;
                cumulativeTime = osrmResult.durationMin;
            } else {
                totalGroupDistance = Number(totalGroupDistance.toFixed(2));
            }

            const timeDelivery = Number(cumulativeTime.toFixed(1));

            const deliveryFee = Number(
                (SHOP_CONFIG.rider_base_fee + totalGroupDistance * SHOP_CONFIG.rider_fee_per_km_box * totalGroupBoxes).toFixed(2)
            );

            const netProfit = Number(
                (totalGroupBoxes * (SHOP_CONFIG.box_price - SHOP_CONFIG.food_cost) - deliveryFee).toFixed(2)
            );
            const insertRouteSql = `
                INSERT INTO delivery_routes (rider_id, job_code, total_orders, total_boxes, total_distance, time_delivery, delivery_peice, net_profit, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
            `;
            const [routeResult]: any = await db.query(insertRouteSql, [
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

            const savedStops: any[] = [];
            for (const stop of stopsData) {
                const insertStopSql = `
                    INSERT INTO route_stops (route_id, order_id, stop_number, distance_before, total_time, status)
                    VALUES (?, ?, ?, ?, ?, 'pending')
                `;
                const [stopResult]: any = await db.query(insertStopSql, [
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

        const totalRevenue = totalAllBoxes * SHOP_CONFIG.box_price;
        const totalFoodCost = totalAllBoxes * SHOP_CONFIG.food_cost;
        const totalGrossProfit = totalAllBoxes * (SHOP_CONFIG.box_price - SHOP_CONFIG.food_cost);
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
                name: SHOP_CONFIG.name,
                address: SHOP_CONFIG.address,
                latitude: shopLat,
                longitude: shopLng,
            },
            financial_dashboard: dashboard,
            routes: createdRoutes,
        });
    } catch (error) {
        if (db) {
            await db.rollback();
        }
        console.error("Error optimizing routes:", error);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        db?.release();
    }
});

router.get("/all", async (req, res) => {
    try {
        const [routeRows]: any = await conn.query(`
            SELECT dr.*, r.name AS rider_name, r.phone AS rider_phone, r.color AS route_color
            FROM delivery_routes dr
            LEFT JOIN riders r ON dr.rider_id = r.id
            ORDER BY dr.id ASC
        `);

        if (routeRows.length === 0) {
            return res.status(200).json({
                shop: {
                    name: SHOP_CONFIG.name,
                    address: SHOP_CONFIG.address,
                    latitude: SHOP_CONFIG.latitude,
                    longitude: SHOP_CONFIG.longitude,
                },
                financial_dashboard: {
                    total_orders: 0,
                    total_boxes: 0,
                    total_riders_used: 0,
                    total_revenue: 0,
                    total_food_cost: 0,
                    total_gross_profit: 0,
                    total_delivery_cost: 0,
                    net_profit: 0,
                    max_delivery_time_min: 0,
                    is_risk_loss: false,
                    is_risk_late: false,
                },
                routes: [],
            });
        }

        const [stopRows]: any = await conn.query(`
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

        const routes = routeRows.map((route: any) => {
            const stops = stopRows
                .filter((s: any) => s.route_id === route.id)
                .map((s: any) => {
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

        const totalRevenue = totalAllBoxes * SHOP_CONFIG.box_price;
        const totalFoodCost = totalAllBoxes * SHOP_CONFIG.food_cost;
        const totalGrossProfit = totalAllBoxes * (SHOP_CONFIG.box_price - SHOP_CONFIG.food_cost);
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
                name: SHOP_CONFIG.name,
                address: SHOP_CONFIG.address,
                latitude: SHOP_CONFIG.latitude,
                longitude: SHOP_CONFIG.longitude,
            },
            financial_dashboard: dashboard,
            routes: routes,
        });
    } catch (error) {
        console.error("Error fetching latest routes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.get("/job/:jobCode", async (req, res) => {
    try {
        const jobCode = req.params.jobCode;
        const [routeRows]: any = await conn.query(`
            SELECT dr.*, r.name AS rider_name, r.phone AS rider_phone
            FROM delivery_routes dr
            LEFT JOIN riders r ON dr.rider_id = r.id
            WHERE dr.job_code = ?
        `, [jobCode]);

        if (routeRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบใบงานตามรหัสที่ระบุ" });
        }

        const route = routeRows[0];
        const [stopRows]: any = await conn.query(`
            SELECT rs.*, o.boxes, o.menu, c.name AS customer_name, c.phone AS customer_phone, c.address, c.latitude, c.longitude
            FROM route_stops rs
            LEFT JOIN orders o ON rs.order_id = o.id
            LEFT JOIN customers c ON o.customer_id = c.id
            WHERE rs.route_id = ?
            ORDER BY rs.stop_number ASC
        `, [route.id]);

        const stops = stopRows.map((s: any) => {
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
    } catch (error) {
        console.error("Error fetching job details:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.patch("/stops/:stopId/status", async (req, res) => {
    try {
        const stopId = parseInt(req.params.stopId, 10);
        const { status } = req.body;
        const newStatus = status || "delivered";

        const [stopRows]: any = await conn.query("SELECT * FROM route_stops WHERE id = ?", [stopId]);
        if (stopRows.length === 0) {
            return res.status(404).json({ error: "ไม่พบข้อมูลจุดส่งนี้" });
        }
        const stop = stopRows[0];

        await conn.query(
            "UPDATE route_stops SET status = ?, delivered_at = NOW() WHERE id = ?",
            [newStatus, stopId]
        );
        await conn.query("UPDATE orders SET status = ? WHERE id = ?", [newStatus, stop.order_id]);

        const [allStops]: any = await conn.query("SELECT status FROM route_stops WHERE route_id = ?", [stop.route_id]);
        const allDelivered = allStops.every((s: any) => s.status === "delivered");
        if (allDelivered) {
            await conn.query("UPDATE delivery_routes SET status = 'completed' WHERE id = ?", [stop.route_id]);
        }

        res.status(200).json({
            message: "อัปเดตสถานะจัดส่งสำเร็จ",
            stop_id: stopId,
            status: newStatus,
            all_route_completed: allDelivered,
        });
    } catch (error) {
        console.error("Error updating stop status:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

router.delete("/all", async (req, res) => {
    try {
        await conn.query("DELETE FROM route_stops");
        await conn.query("DELETE FROM delivery_routes");
        await conn.query("UPDATE orders SET status = 'pending' WHERE status = 'assigned'");
        res.status(200).json({ message: "รีเซ็ตรอบจัดส่งเรียบร้อยแล้ว" });
    } catch (error) {
        console.error("Error resetting delivery routes:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});