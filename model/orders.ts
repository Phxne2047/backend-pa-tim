export interface Orders {
    id: number;
    customer_id: number;
    boxes: number;
    status: string;
    menu: string;
    created_at: Date;
    name: string;
    phone: string;
    address: string;
    latitude: string;
    longitude: string;
    distance_km: number;
}

export interface OrdersPostRequests {
    id?: number;
    customer_id: number;
    boxes: number;
    menu?: string;
    status?: string;
}

export interface OrderMockRequests {
    count?: number;
    clear_existing?: boolean;
}
