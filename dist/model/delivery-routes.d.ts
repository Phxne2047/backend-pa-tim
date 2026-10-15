export interface DeliveryRoute {
    id?: number;
    rider_id: number;
    job_code: string;
    total_orders: number;
    total_boxes: number;
    total_distance: number;
    time_delivery: number;
    delivery_peice: number;
    net_profit: number;
    status: string;
}
export interface RouteStop {
    id?: number;
    route_id: number;
    order_id: number;
    stop_number: number;
    distance_before: number;
    total_time: number;
    status: string;
    delivered_at?: Date | null;
}
//# sourceMappingURL=delivery-routes.d.ts.map