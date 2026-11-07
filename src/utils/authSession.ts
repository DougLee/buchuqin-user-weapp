import type { SessionUser } from '../types';

// Transport and cart modules must not import the session store back through the API graph.
let session: { applyUser(user: SessionUser): void; ensureLogin(): Promise<void> } | undefined;
export function registerAuthSession(handler: NonNullable<typeof session>) { session = handler; }
export function applyAuthenticatedUser(user: SessionUser) {
  if (!session) throw new Error('登录状态尚未初始化，请重试');
  session.applyUser(user);
}
export function ensureAuthenticatedSession() {
  if (!session) return Promise.reject(new Error('登录状态尚未初始化，请重试'));
  return session.ensureLogin();
}
