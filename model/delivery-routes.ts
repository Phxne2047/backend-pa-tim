export interface DeliveryRoute {
    id:    number;
    rider_id:  number;
    job_code: string;
    total_orders: number;
    total_boxes: number;
    total_distance: number;
    time_delivery: number;
    delivery_peice: number;
    net_profit: number;
    status: string;
}