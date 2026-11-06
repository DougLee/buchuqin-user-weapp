import { request } from './request';
import type { Address } from '../types';

/** Checkout and address management must see the same full, campus-scoped list. */
export async function fetchAddresses(): Promise<Address[]> {
  const items = new Map<string, Address>();
  for (let page = 1; ; page++) {
    const result = await request<{ items: Address[]; total: number; pageSize: number }>(`/addresses?page=${page}&pageSize=100`);
    for (const address of result.items) items.set(address.id, address);
    if (!result.items.length || page * result.pageSize >= result.total) break;
  }
  return [...items.values()];
}
