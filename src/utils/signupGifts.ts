export interface SignupGiftRow {
  id: string;
  status: string;
  coupon: { name: string; amount: number; threshold: number; trigger?: string; expiresAt: string | null };
}
export function usableSignupGifts(rows: SignupGiftRow[], now = Date.now()) {
  return rows.filter(row => row.coupon.trigger === 'signup' && ['claimed', 'released'].includes(row.status) && (!row.coupon.expiresAt || new Date(row.coupon.expiresAt).getTime() > now));
}
export function scopedUiKey(name: string, userId?: string, campusId?: string, channel?: string) {
  return userId && campusId ? `${name}:${userId}:${campusId}${channel ? ':' + channel : ''}` : '';
}
