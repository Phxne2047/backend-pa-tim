# 📖 API Documentation - PaTim Delivery Backend
> ระบบ Web API จัดการข้อมูลลูกค้าและออเดอร์ร้านป้าติ๋ม ข้าวกล่องเดลิเวอรี (ส่งด่วนมื้อเที่ยง)  
> **Production Base URL:** `https://backend-pa-tim.vercel.app`  
> 💡 **แนะนำ:** แนะนำเปิดคู่มือนี้บน **Obsidian** หรือ Markdown Reader ที่รองรับการแสดงผล JSON/Code Highlight และ Callout เพื่อความสะดวกและสวยงามในการอ่านเอกสาร

---

## 📋 สรุปรายการ Endpoint ทั้งหมด (API Collection Summary)

### 👥 1. กลุ่ม API ข้อมูลลูกค้า (`/customers`)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| **GET** | `/customers` | ดึงรายการข้อมูลลูกค้าทั้งหมด |
| **GET** | `/customers/near` | ค้นหาลูกค้าในระยะที่กำหนดจากพิกัด (Default: ร้านค้า, `1.0` กม.) |
| **GET** | `/customers/search` | ค้นหาลูกค้าจากส่วนหนึ่งของชื่อหรือนามสกุล (`?name=...`) |
| **GET** | `/customers/:id` | ดึงข้อมูลลูกค้ารายบุคคลตาม ID |
| **POST** | `/customers` | เพิ่มข้อมูลลูกค้าใหม่ |
| **PUT** | `/customers/:id` | แก้ไขข้อมูลลูกค้าทั้งหมดตาม ID (Full Update) |
| **PATCH** | `/customers/:id` | แก้ไขข้อมูลลูกค้าเฉพาะบางฟิลด์ตาม ID (Partial Update) |
| **DELETE** | `/customers/:id` | ลบข้อมูลลูกค้าตาม ID |

### 🍱 2. กลุ่ม API รายการสั่งซื้อ (`/orders`)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| **GET** | `/orders` | ดึงรายการสั่งซื้อทั้งหมด พร้อมข้อมูลลูกค้าและระยะทาง |
| **GET** | `/orders/near` | แสดงรายการสั่งซื้อในระยะที่กำหนดจากพิกัด (Default: ร้านค้า, `2.0` กม.) |
| **GET** | `/orders/:id` | ดึงข้อมูลคำสั่งซื้อเดี่ยวตาม ID พร้อมข้อมูลลูกค้าและระยะทาง |
| **POST** | `/orders/mock` | จำลองรายการสั่งซื้อ 20–30 รายการ โดยสุ่มลูกค้าจริงในระบบ |
| **POST** | `/orders` | เพิ่มรายการคำสั่งซื้อใหม่ |
| **PUT** | `/orders/:id` | แก้ไขข้อมูลคำสั่งซื้อตาม ID (Full Update) |
| **PATCH** | `/orders/:id` | แก้ไขจำนวนกล่องหรือข้อมูลเฉพาะฟิลด์ (Partial Update) |
| **DELETE** | `/orders/:id` | ลบรายการคำสั่งซื้อตาม ID |
| **DELETE** | `/orders/all` | ลบรายการคำสั่งซื้อทั้งหมด |

### 🚴‍♂️ 3. กลุ่ม API ไรเดอร์ (`/riders`)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| **GET** | `/riders` | ดึงรายชื่อไรเดอร์ทั้งหมดพร้อมรหัสสีประจำตัวสำหรับวาดเส้นทางบนแผนที่ |

### 🗺️ 4. กลุ่ม API จัดเส้นทางและงานไรเดอร์ (`/delivery-routes`)
| Method | Endpoint | คำอธิบาย |
| :--- | :--- | :--- |
| **GET** | `/delivery-routes` | ดึงข้อมูลรายการสายส่งทั้งหมดจากตาราง `delivery_routes` แบบดิบ |
| **POST** | `/delivery-routes/optimize` | จัดเส้นทางอัจฉริยะ (Optimize / Re-calculate) แบ่งสายไรเดอร์และคำนวณกำไร/เวลา |
| **GET** | `/delivery-routes/all` | ดึงข้อมูลสายส่งทั้งหมดรอบล่าสุด พร้อมจุดส่ง พิกัดวาดแผนที่ และแผงวิเคราะห์การเงิน/เวลา |
| **GET** | `/delivery-routes/job/:jobCode` | ค้นหาใบงานของไรเดอร์ (Job Lookup) ดูสรุปหยิบของ และลำดับจุดส่งพร้อมลิงก์ Google Maps |
| **PATCH** | `/delivery-routes/stops/:stopId/status` | ไรเดอร์กดอัปเดตสถานะส่งสำเร็จ (Mark as Delivered) |
| **DELETE** | `/delivery-routes/all` | รีเซ็ตรอบจัดส่ง ลบสายส่งและคืนสถานะออเดอร์กลับเป็น `pending` |

---


## 📍 ข้อมูลพิกัดร้านค้าอ้างอิง (Shop Reference)
- **ชื่อร้าน:** ร้านป้าติ๋ม ข้าวกล่องเดลิเวอรี (ส่งด่วนมื้อเที่ยง)
- **ที่อยู่:** คณะวิทยาการสารสนเทศ มมส.
- **เบอร์โทร:** `081-795-8189`
- **พิกัดร้าน:** `Latitude: 16.24683915336477`, `Longitude: 103.2519629291392`
- **รัศมีบริการร้านค้า:** `3.0` กิโลเมตร

---

# 👥 หมวดที่ 1: จัดการข้อมูลลูกค้า (`/customers`)

### 1. `GET /customers`
ดึงรายชื่อลูกค้าทั้งหมดในระบบ

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "name": "กิตติศักดิ์ พลสว่าง",
    "phone": "0812345678",
    "address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
    "latitude": "16.2482310",
    "longitude": "103.2501250",
    "created_at": "2026-10-03T20:00:00.000Z"
  }
]
```

---

### 2. `GET /customers/near`
ค้นหาลูกค้าทั้งหมดในระยะที่กำหนด (ค่าเริ่มต้น `1.0` กิโลเมตร) จากพิกัดที่ระบุ (หากไม่ระบุพิกัดจะใช้พิกัดร้านค้าโดยอัตโนมัติ) เรียงลำดับจากใกล้ไปไกล

- **Method:** `GET`
- **URL ตัวอย่าง:**
  - ใช้พิกัดร้านค้า (1.0 กม.): `https://backend-pa-tim.vercel.app/customers/near`
  - กำหนดระยะทางเอง: `https://backend-pa-tim.vercel.app/customers/near?km=1.5`
  - กำหนดพิกัดและระยะทางเอง: `https://backend-pa-tim.vercel.app/customers/near?lat=16.246839&lng=103.251962&km=1.0`
- **Query Parameters:**
  - `km` *(Optional, number)*: ระยะทางกิโลเมตร (Default = `1.0`)
  - `lat` *(Optional, number)*: ละติจูด (Default = พิกัดร้านค้า)
  - `lng` *(Optional, number)*: ลองจิจูด (Default = พิกัดร้านค้า)

#### Response (`200 OK`):
```json
[
  {
    "id": 23,
    "name": "นพรัตน์ แสนสุข",
    "phone": "0836789014",
    "address": "สำนักวิทยบริการ (ห้องสมุด มมส)",
    "latitude": "16.2452000",
    "longitude": "103.2518000",
    "created_at": "2026-10-03T20:55:00.000Z",
    "distance_km": 0.18
  }
]
```

---

### 3. `GET /customers/search`
ค้นหาลูกค้าจากส่วนหนึ่งของชื่อ หรือนามสกุล

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers/search?name=กิตติ`
- **Query Parameters:**
  - `name` *(Required, string)*: คำค้นหาชื่อหรือนามสกุล (เช่น `กิตติ`, `สมชาย`)

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "name": "กิตติศักดิ์ พลสว่าง",
    "phone": "0812345678",
    "address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
    "latitude": "16.2482310",
    "longitude": "103.2501250",
    "created_at": "2026-10-03T20:00:00.000Z"
  }
]
```

---

### 4. `GET /customers/:id`
ดึงข้อมูลลูกค้าเฉพาะรายตาม ID

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers/1`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "name": "กิตติศักดิ์ พลสว่าง",
    "phone": "0812345678",
    "address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
    "latitude": "16.2482310",
    "longitude": "103.2501250",
    "created_at": "2026-10-03T20:00:00.000Z"
  }
]
```

---

### 5. `POST /customers`
เพิ่มข้อมูลลูกค้าใหม่

- **Method:** `POST`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "สมชาย สุขใจ",
  "phone": "0891112233",
  "address": "หอพักศิริพร ห้อง 101 ท่าขอนยาง",
  "latitude": 16.2475000,
  "longitude": 103.2510000
}
```

#### Response (`201 Created`):
```json
{
  "affected_row": 1,
  "last_idx": 21
}
```

---

### 6. `PUT /customers/:id`
แก้ไขข้อมูลลูกค้าทั้งหมดตาม ID

- **Method:** `PUT`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers/1`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "กิตติศักดิ์ พลสว่าง (แก้ไข)",
  "phone": "0819998888",
  "address": "หอพักกัญญาพัชร ห้อง 305 ซอยเจริญผล ท่าขอนยาง",
  "latitude": 16.2482310,
  "longitude": 103.2501250
}
```

#### Response (`200 OK`):
```json
{
  "affected_row": 1
}
```

---

### 7. `PATCH /customers/:id`
แก้ไขข้อมูลลูกค้าเฉพาะบางฟิลด์

- **Method:** `PATCH`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers/1`
- **Headers:** `Content-Type: application/json`
- **Request Body Example:**
```json
{
  "phone": "0898887766"
}
```

#### Response (`200 OK`):
```json
{
  "affected_row": 1
}
```

---

### 8. `DELETE /customers/:id`
ลบข้อมูลลูกค้าตาม ID

- **Method:** `DELETE`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/customers/21`

#### Response (`200 OK`):
```json
{
  "affected_row": 1
}
```

---

# 🍱 หมวดที่ 2: จัดการรายการสั่งซื้อ (`/orders`)

### 9. `GET /orders`
ดึงรายการคำสั่งซื้อทั้งหมด พร้อม JOIN ข้อมูลลูกค้าและคำนวณระยะทางจากร้านค้า

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "boxes": 2,
    "status": "pending",
    "menu": "ข้าวกะเพราหมูสับไข่เค็ม",
    "created_at": "2026-10-04T03:00:44.000Z",
    "name": "กิตติศักดิ์ พลสว่าง",
    "phone": "0812345678",
    "address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
    "latitude": "16.2482310",
    "longitude": "103.2501250",
    "distance_km": 0.25
  }
]
```

---

### 10. `GET /orders/near`
แสดงรายการสั่งซื้อทั้งหมดในระยะที่กำหนด (ค่าเริ่มต้น `2.0` กิโลเมตร) จากพิกัดที่ระบุ (หากไม่ระบุพิกัดจะใช้พิกัดร้านค้าโดยอัตโนมัติ)

- **Method:** `GET`
- **URL ตัวอย่าง:**
  - ใช้พิกัดร้านค้า (2.0 กม.): `https://backend-pa-tim.vercel.app/orders/near`
  - กำหนดระยะทางเอง: `https://backend-pa-tim.vercel.app/orders/near?km=1.5`
  - กำหนดพิกัดและระยะทางเอง: `https://backend-pa-tim.vercel.app/orders/near?lat=16.246839&lng=103.251962&km=2.0`
- **Query Parameters:**
  - `km` *(Optional, number)*: ระยะทางกิโลเมตร (Default = `2.0`)
  - `lat` *(Optional, number)*: ละติจูด (Default = พิกัดร้านค้า)
  - `lng` *(Optional, number)*: ลองจิจูด (Default = พิกัดร้านค้า)

#### Response (`200 OK`):
```json
[
  {
    "id": 18,
    "customer_id": 20,
    "boxes": 1,
    "status": "pending",
    "menu": "ข้าวกะเพราไก่ไข่ดาว",
    "created_at": "2026-10-04T03:17:10.000Z",
    "name": "ศศิธร ทรัพย์มาก",
    "phone": "082-435-7689",
    "address": "อาคารพลศึกษา มมส.",
    "latitude": "16.2462000",
    "longitude": "103.2465000",
    "distance_km": 0.18
  }
]
```

---

### 11. `GET /orders/:id`
ดึงข้อมูลคำสั่งซื้อเดี่ยวตาม ID พร้อมข้อมูลลูกค้าและระยะทาง

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/1`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "customer_id": 1,
    "boxes": 2,
    "status": "pending",
    "menu": "ข้าวกะเพราหมูสับไข่เค็ม",
    "created_at": "2026-10-04T03:00:44.000Z",
    "name": "กิตติศักดิ์ พลสว่าง",
    "phone": "0812345678",
    "address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
    "latitude": "16.2482310",
    "longitude": "103.2501250",
    "distance_km": 0.25
  }
]
```

---

### 12. `POST /orders/mock`
จำลองรายการสั่งซื้อ 20–30 รายการ โดยสุ่มจับคู่ลูกค้าจริงในระบบ สุ่มจำนวน **1–3 กล่อง** เมนูอาหาร และเวลาสั่งซื้อ

- **Method:** `POST`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/mock`
- **Headers:** `Content-Type: application/json`
- **Request Body (Optional):**
```json
{
  "clear_existing": true
}
```

#### Response (`201 Created`):
```json
{
  "message": "Successfully simulated 25 orders.",
  "count": 25,
  "orders": [
    {
      "id": 1,
      "customer_id": 1,
      "customer_name": "กิตติศักดิ์ พลสว่าง",
      "customer_phone": "0812345678",
      "customer_address": "หอพักกัญญาพัชร ห้อง 302 ซอยเจริญผล ท่าขอนยาง",
      "boxes": 2,
      "menu": "ข้าวกะเพราหมูสับไข่เค็ม",
      "status": "pending",
      "created_at": "2026-10-04T03:00:44.000Z"
    }
  ]
}
```

---

### 13. `POST /orders`
เพิ่มรายการคำสั่งซื้อใหม่

- **Method:** `POST`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "customer_id": 1,
  "boxes": 2,
  "menu": "ข้าวกะเพราหมูกรอบไข่ดาว",
  "status": "pending"
}
```

#### Response (`201 Created`):
```json
{
  "affected_row": 1,
  "last_idx": 21
}
```

---

### 14. `PUT /orders/:id`
แก้ไขข้อมูลคำสั่งซื้อทั้งหมดตาม ID

- **Method:** `PUT`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/1`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "customer_id": 1,
  "boxes": 3,
  "menu": "ข้าวผัดต้มยำกุ้ง",
  "status": "pending"
}
```

#### Response (`200 OK`):
```json
{
  "message": "Order updated successfully",
  "affected_row": 1
}
```

---

### 15. `PATCH /orders/:id`
แก้ไขจำนวนกล่องหรือข้อมูลเฉพาะฟิลด์

- **Method:** `PATCH`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/1`
- **Headers:** `Content-Type: application/json`
- **Request Body Example (แก้ไขจำนวนกล่อง):**
```json
{
  "boxes": 3
}
```

#### Response (`200 OK`):
```json
{
  "affected_row": 1,
  "order": {
    "id": 1,
    "customer_id": 1,
    "boxes": 3,
    "menu": "ข้าวกะเพราหมูสับไข่เค็ม",
    "status": "pending"
  }
}
```

---

### 16. `DELETE /orders/:id`
ลบรายการคำสั่งซื้อเดี่ยวตาม ID

- **Method:** `DELETE`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/1`

#### Response (`200 OK`):
```json
{
  "affected_row": 1
}
```

---

### 17. `DELETE /orders/all`
ล้าง (ลบทั้งหมด) รายการคำสั่งซื้อทั้งหมดในระบบ

- **Method:** `DELETE`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/orders/all`

#### Response (`200 OK`):
```json
{
  "affected_row": 25
}
```

# 🚴‍♂️ หมวดที่ 3: ข้อมูลไรเดอร์ (`/riders`)

### 18. `GET /riders`
ดึงรายชื่อไรเดอร์ทั้งหมดในระบบ พร้อมเบอร์โทรและรหัสสีประจำตัว (`color`) สำหรับใช้วาดเส้นทาง Polyline แยกสีบนแผนที่

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/riders`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "name": "ไรเดอร์สมศักดิ์ ว่องไว (Rider 1)",
    "phone": "091-100-0001",
    "color": "#EF4444"
  },
  {
    "id": 2,
    "name": "ไรเดอร์ประเสริฐ รวดเร็ว (Rider 2)",
    "phone": "091-100-0002",
    "color": "#3B82F6"
  },
  {
    "id": 3,
    "name": "ไรเดอร์อนุชา มุ่งมั่น (Rider 3)",
    "phone": "091-100-0003",
    "color": "#10B981"
  }
]
```

---

# 🗺️ หมวดที่ 4: จัดเส้นทางและงานไรเดอร์ (`/delivery-routes`)

### 19. `GET /delivery-routes`
ดึงรายการสายส่งทั้งหมดจากตาราง `delivery_routes` แบบดิบ

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes`

#### Response (`200 OK`):
```json
[
  {
    "id": 1,
    "rider_id": 1,
    "job_code": "JOB-01",
    "total_orders": 3,
    "total_boxes": 7,
    "total_distance": "3.85",
    "time_delivery": "7.70",
    "delivery_peice": "74.29",
    "net_profit": "100.71",
    "status": "pending"
  }
]
```

---

### 20. `POST /delivery-routes/optimize`
กดปุ่ม **"จัดเส้นทาง"** หรือ **"คำนวณใหม่ (Re-calculate)"**  
ระบบจะดึงออเดอร์ที่สถานะ `pending` มาจัดกลุ่มอัตโนมัติภายใต้เงื่อนไข:
- มอเตอร์ไซค์ 1 คัน รับได้สูงสุด **ไม่เกิน 10 กล่อง**
- ไรเดอร์ 1 คน รับงานได้ **ไม่เกิน 3 ออเดอร์ (3 จุดส่ง)**
- เริ่มออกส่ง 11:30 น. และต้องถึงจุดสุดท้ายก่อน 12:30 น. ($\le 60$ นาที)
- จัดกลุ่มตามจุดส่งที่อยู่ใกล้เคียงกันที่สุด (Nearest Neighbor) เพื่อประหยัดระยะทางและน้ำมัน
- คำนวณค่าส่ง: $15 + (\text{ระยะทางรวม} \times 2 \times \text{จำนวนกล่อง})$
- คำนวณกำไรสุทธิ: $(\text{จำนวนกล่อง} \times 25) - \text{ค่าขนส่ง}$
- บันทึกลงตาราง `delivery_routes` และ `route_stops` อัตโนมัติ พร้อมอัปเดตสถานะออเดอร์เป็น `assigned`

- **Method:** `POST`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes/optimize`
- **Request Body:** ไม่ต้องส่ง (หรือส่ง `{}` เปล่าได้)

#### Response (`200 OK`):
```json
{
  "message": "จัดเส้นทางสำเร็จ",
  "shop": {
    "name": "ร้านป้าติ๋ม ข้าวกล่องเดลิเวอรี (ส่งด่วนมื้อเที่ยง)",
    "address": "คณะวิทยาการสารสนเทศ มมส.",
    "latitude": 16.24683915336477,
    "longitude": 103.2519629291392
  },
  "financial_dashboard": {
    "total_orders": 20,
    "total_boxes": 38,
    "total_riders_used": 7,
    "total_revenue": 2470,
    "total_food_cost": 1520,
    "total_delivery_cost": 192.92,
    "net_profit": 757.08,
    "max_delivery_time_min": 7.8,
    "is_risk_loss": false,
    "is_risk_late": false
  },
  "routes": [
    {
      "route_id": 1,
      "job_code": "JOB-01",
      "rider_id": 1,
      "rider_name": "ไรเดอร์สมศักดิ์ ว่องไว (Rider 1)",
      "rider_phone": "091-100-0001",
      "route_color": "#EF4444",
      "total_orders": 3,
      "total_boxes": 7,
      "total_distance": 3.85,
      "time_delivery": 7.7,
      "delivery_peice": 74.29,
      "net_profit": 100.71,
      "status": "pending",
      "stops": [
        {
          "stop_id": 1,
          "stop_number": 1,
          "order_id": 4,
          "customer_name": "คุณศศิธร ทรัพย์มาก",
          "customer_phone": "0891112233",
          "address": "หอพักอินเตอร์พาร์ค คณะมนุษย์ฯ",
          "boxes": 2,
          "menu": "ข้าวกะเพราทะเลรวมมิตร",
          "latitude": 16.2462,
          "longitude": 103.2465,
          "distance_before": 0.6,
          "total_time": 1.2,
          "status": "pending",
          "google_map_url": "https://www.google.com/maps/dir/?api=1&destination=16.2462,103.2465"
        }
      ]
    }
  ]
}
```

---

### 21. `GET /delivery-routes/all`
ดึงข้อมูลรอบจัดส่งล่าสุดทั้งหมด ประกอบด้วยพิกัดร้านค้า, แผงวิเคราะห์การเงินและเวลา (Financial Dashboard) และเส้นทางของไรเดอร์ทุกคนพร้อมจุดส่งและลิงก์ Google Maps สำหรับเปิดหน้าจอหรือ Refresh หน้าเว็บ

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes/all`

#### Response (`200 OK`):
โครงสร้างเหมือนกับ Response ของ `POST /delivery-routes/optimize` ทุกประการ

---

### 22. `GET /delivery-routes/job/:jobCode`
สำหรับหน้าจอไรเดอร์ (**Rider Portal - Mobile Web**): ค้นหาข้อมูลใบงานด้วยรหัส `job_code` (เช่น `JOB-01`)
- **Pickup Summary:** สรุปข้อมูลรับสินค้า เช่น ต้องหยิบข้าวกล่องกี่กล่อง (ไม่เกิน 10 กล่อง), มีกี่จุดส่ง, เวลาที่คาดว่าจะใช้, ค่าจ้างที่จะได้รับ
- **Delivery Sequence:** ลำดับขั้นตอนจุดส่ง (จุดที่ 1 -> จุดที่ 2 -> จุดที่ 3) พร้อมชื่อลูกค้า, เบอร์โทร, เมนู, จำนวนกล่อง และลิงก์เปิด Google Maps นำทางพิกัดทันที

- **Method:** `GET`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes/job/JOB-01`

#### Response (`200 OK`):
```json
{
  "job_code": "JOB-01",
  "rider_name": "ไรเดอร์สมศักดิ์ ว่องไว (Rider 1)",
  "rider_phone": "091-100-0001",
  "status": "pending",
  "pickup_summary": {
    "total_boxes": 7,
    "total_stops": 3,
    "total_distance": 3.85,
    "time_delivery": 7.7,
    "earnings": 74.29
  },
  "delivery_sequence": [
    {
      "step": 1,
      "stop_id": 1,
      "customer_name": "คุณศศิธร ทรัพย์มาก",
      "customer_phone": "0891112233",
      "address": "หอพักอินเตอร์พาร์ค คณะมนุษย์ฯ",
      "boxes": 2,
      "menu": "ข้าวกะเพราทะเลรวมมิตร",
      "status": "pending",
      "distance_before": 0.6,
      "total_time": 1.2,
      "google_maps_nav_url": "https://www.google.com/maps/dir/?api=1&destination=16.2462,103.2465"
    }
  ]
}
```

---

### 23. `PATCH /delivery-routes/stops/:stopId/status`
สำหรับไรเดอร์กดปุ่ม **"ส่งสำเร็จ" (Mark as Delivered)** ประจำแต่ละจุดส่ง
- อัปเดตสถานะจุดส่งในตาราง `route_stops` เป็น `delivered` พร้อมบันทึกเวลาจัดส่ง (`delivered_at = NOW()`)
- อัปเดตสถานะออเดอร์ในตาราง `orders` เป็น `delivered`
- หากส่งครบทุกจุดในสายส่งนั้นแล้ว ระบบจะปรับสถานะของสายส่งใน `delivery_routes` เป็น `completed` ให้อัตโนมัติ

- **Method:** `PATCH`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes/stops/1/status`
- **Headers:** `Content-Type: application/json`
- **Request Body Example:**
```json
{
  "status": "delivered"
}
```

#### Response (`200 OK`):
```json
{
  "message": "อัปเดตสถานะจัดส่งสำเร็จ",
  "status": "delivered",
  "all_route_completed": false
}
```

---

### 24. `DELETE /delivery-routes/all`
ล้างรอบจัดส่งปัจจุบันทั้งหมด
- ลบข้อมูลในตาราง `route_stops` และ `delivery_routes`
- คืนสถานะของออเดอร์ที่เคยจัดส่งแล้วจาก `assigned` กลับมาเป็น `pending` เพื่อให้สามารถกดจัดเส้นทางใหม่ได้

- **Method:** `DELETE`
- **URL ตัวอย่าง:** `https://backend-pa-tim.vercel.app/delivery-routes/all`

#### Response (`200 OK`):
```json
{
  "message": "รีเซ็ตรอบจัดส่งเรียบร้อยแล้ว"
}
```

---

## 🛠️ รหัสสถานะการตอบกลับ (HTTP Status Codes)


| Status Code | ความหมาย | คำอธิบาย |
| :--- | :--- | :--- |
| `200 OK` | สำเร็จ | ดึงข้อมูล, แก้ไข หรือลบข้อมูลสำเร็จ |
| `201 Created` | สร้างสำเร็จ | เพิ่มข้อมูลลูกค้า, ออเดอร์ หรือสร้าง Mock สำเร็จ |
| `400 Bad Request` | ข้อมูลไม่ถูกต้อง | ข้อมูลใน Request ไม่ครบถ้วนหรือไม่ถูกต้องตามเงื่อนไข |
| `404 Not Found` | ไม่พบข้อมูล | ไม่พบ ID ที่ระบุในระบบ |
| `500 Internal Server Error` | ข้อผิดพลาดของเซิร์ฟเวอร์ | เกิดข้อผิดพลาดฝั่ง Server หรือฐานข้อมูล |
