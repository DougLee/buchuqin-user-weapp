export interface UserOrderRow {
  key: string;
  businessType: 'day' | 'night';
  id: string;
  orderNo: string;
  status: string;
  statusText: string;
  createdAt: string;
  timeoutAt: string | null;
  paidAt: string | null;
  storeId?: string;
  payableAmount: number;
  deliveryText: string;
  items: Array<{ id: string; name: string; image: string; quantity: number }>;
}
export interface UserOrderPage {
  items: UserOrderRow[];
  total: number;
  page: number;
  pageSize: number;
  errors: Array<'day' | 'night'>;
}
