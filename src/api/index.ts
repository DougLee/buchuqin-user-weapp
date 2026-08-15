import { request } from "./request";
import type {
  Address,
  AfterSale,
  Cart,
  Category,
  Coupon,
  Notification,
  Order,
  Product,
  Refund,
  Settlement,
} from "../types";
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export const api = {
  login: () =>
    request<{ token: string; user: Record<string, string> }>(
      "/auth/test-login",
      { method: "POST", data: { identity: "user" } },
    ),
  home: () =>
    request<{
      campus: { name: string };
      banners: Array<{
        id: string;
        title: string;
        subtitle: string;
        badge: string;
        color: string;
      }>;
      categories: Category[];
      hotProducts: Product[];
    }>("/home"),
  products: async (categoryId = "all", keyword = "") =>
    (
      await request<PageResult<Product>>(
        `/products?categoryId=${categoryId}&keyword=${encodeURIComponent(keyword)}`,
      )
    ).items,
  product: (id: string) => request<Product>(`/products/${id}`),
  cart: () => request<Cart>("/cart"),
  updateCart: (items: Array<{ productId: string; quantity: number }>) =>
    request<Cart>("/cart", { method: "PUT", data: { items } }),
  addresses: () => request<Address[]>("/addresses"),
  addAddress: (data: Record<string, unknown>) =>
    request<Address>("/addresses", { method: "POST", data }),
  coupons: () => request<Coupon[]>("/coupons"),
  slots: () =>
    request<Array<{ id: string; label: string; available: boolean }>>(
      "/delivery/slots",
    ),
  checkout: (data: Record<string, unknown>) =>
    request<Settlement>("/orders/checkout", { method: "POST", data }),
  createOrder: (data: Record<string, unknown>) =>
    request<Order>("/orders", { method: "POST", data }),
  payOrder: (id: string) =>
    request<Order>(`/orders/${id}/pay`, { method: "POST" }),
  orders: async (status = "all") =>
    (await request<PageResult<Order>>(`/orders?status=${status}`)).items,
  order: (id: string) => request<Order>(`/orders/${id}`),
  cancelOrder: (id: string) =>
    request<Order>(`/orders/${id}/cancel`, { method: "POST" }),
  createAfterSale: (id: string, data: Record<string, unknown>) =>
    request<AfterSale>(`/orders/${id}/after-sales`, { method: "POST", data }),
  afterSales: () => request<AfterSale[]>("/after-sales"),
  refunds: () => request<Refund[]>("/refunds"),
  notifications: () => request<Notification[]>("/notifications"),
  readNotification: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
};
