export interface Customer {
    id: number;
    name: string;
    phone: string;
    address: string;
    latitude: string | number;
    longitude: string | number;
    created_at: Date;
}
export interface CustomerPostRequest {
    id?: number;
    name: string;
    phone: string;
    address: string;
    latitude: string | number;
    longitude: string | number;
}
//# sourceMappingURL=customers.d.ts.map