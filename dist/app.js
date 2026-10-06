"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const customers_1 = require("./controller/customers");
const orders_1 = require("./controller/orders");
exports.app = (0, express_1.default)();
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
exports.app.use(express_1.default.text());
// แปลงข้อมูลรูปแบบ JSON (JSON Body)
exports.app.use(express_1.default.json());
exports.app.use("/customers", customers_1.router);
exports.app.use("/orders", orders_1.router);
//# sourceMappingURL=app.js.map