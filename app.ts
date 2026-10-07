import express from "express";
import { router as customers } from "./controller/customers";
import { router as orders } from "./controller/orders";
import cors from "cors";

export const app = express();

// const allowedOrigins = [
//     "http://127.0.0.1:5500",
//     "http://localhost:3000",
//     "https://your-production-frontend.com",
// ];

// app.use(
//     cors({
//         origin: function (origin, callback) {
//             // เช็กหากว่าไม่มี origin (ยิงผ่าน Postman หรือเบื้องหลัง) หรือโดเมนตรงกับ whitelist
//             if (!origin || allowedOrigins.indexOf(origin) !== -1) {
//                 callback(null, true);
//             } else {
//                 callback(new Error("Not allowed by CORS"));
//             }
//         },
//         methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
//         allowedHeaders: ["Content-Type", "Authorization"],
//     })
// );

// แปลงข้อมูลแบบข้อความทั่วไป (Text Body)
app.use(express.text());

// แปลงข้อมูลรูปแบบ JSON (JSON Body)
app.use(express.json());



app.use("/customers", customers);
app.use("/orders", orders);

export default app;