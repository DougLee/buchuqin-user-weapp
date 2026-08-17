export interface Product {
  id: string;
  categoryId: string;
  name: string;
  subtitle: string;
  price: number;
  originalPrice: number;
  stock: number;
  sales: number;
  tag: string;
  image: string;
  weight: number;
}
export interface Category {
  id: string;
  name: string;
}
export interface CartLine {
  product: Product;
  quantity: number;
}
export interface Cart {
  items: CartLine[];
  productAmount: number;
  totalQuantity: number;
  deliveryThreshold: number;
}
export interface Address {
  id: string;
  campusName: string;
  buildingName: string;
  floor: number;
  room: string;
  contactName: string;
  phone: string;
  isDefault: boolean;
}
export interface Order {
  id: string;
  orderNo: string;
  status: string;
  statusText: string;
  createdAt: string;
  payableAmount: number;
  productAmount: number;
  deliveryFee: number;
  discount: number;
  items: CartLine[];
  address: Address;
  estimatedArrival: string;
  timeline: Array<{
    key: string;
    title: string;
    description: string;
    time?: string;
    done: boolean;
  }>;
}
export interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
  timestamp: string;
}
/** 登录后的会话用户（test-login 与 wechat-login 统一口径，avatar 等字段可缺省） */
export interface SessionUser {
  id: string;
  campusId?: string;
  role?: string;
  nickname: string;
  phone?: string;
  avatar?: string;
}
export interface LoginResult {
  token: string;
  user: SessionUser;
}
export interface Coupon {
  id: string;
  name: string;
  amount: number;
  threshold: number;
  status: string;
  expiresAt: string;
  total?: number;
  remain?: number;
}
export type UserCouponStatus = "claimed" | "locked" | "used" | "released";
export interface UserCoupon {
  id: string;
  userId: string;
  couponId: string;
  status: UserCouponStatus;
  claimedAt: string;
  coupon: Coupon;
}
export interface CouponBundle {
  claimable: Coupon[];
  mine: UserCoupon[];
}
export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
}
export interface AfterSale {
  id: string;
  orderId: string;
  type: string;
  description: string;
  images: string[];
  status: string;
  createdAt: string;
}
export interface Refund {
  id: string;
  orderId: string;
  amount: number;
  reason: string;
  status: string;
  createdAt: string;
}
export interface Settlement extends Cart {
  deliveryFee: number;
  discount: number;
  payableAmount: number;
  estimatedArrival: string;
}
