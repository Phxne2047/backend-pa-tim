"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const dbconnect_1 = require("../dbconnect");
exports.router = express_1.default.Router();
exports.router.get("/", async (req, res) => {
    const [rows] = await dbconnect_1.conn.query("SELECT * FROM riders");
    let rider = rows;
    res.json(rider);
});
//# sourceMappingURL=riders.js.map