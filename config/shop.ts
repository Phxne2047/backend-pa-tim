export interface ShopConfig {
    name: string;
    address: string;
    phone: string;
    latitude: number;
    longitude: number;
    delivery_radius_km: number; // รัศมีจัดส่ง 3 กม.
    box_price: number;          // ราคาขาย 65 บาท
    food_cost: number;          // ต้นทุน 40 บาท
    rider_base_fee: number;     // ค่าเรียกรถ 15 บาท
    rider_fee_per_km_box: number; // 2 บาท/กม./กล่อง
}

export const SHOP_CONFIG: ShopConfig = {
    name: "ร้านป้าติ๋ม ข้าวกล่องเดลิเวอรี (ส่งด่วนมื้อเที่ยง)",
    address: "คณะวิทยาการสารสนเทศ มมส.",
    phone: "081-795-8189",
    latitude: 16.24683915336477,
    longitude: 103.2519629291392,
    delivery_radius_km: 3.0,
    box_price: 65,
    food_cost: 40,
    rider_base_fee: 15,
    rider_fee_per_km_box: 2,
};