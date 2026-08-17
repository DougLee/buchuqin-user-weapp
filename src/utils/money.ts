/**
 * 金额单位转换（API-3 契约：后端全链路金额字段为整数分，前端仅展示层转元）。
 * 所有金额展示必须经 fenToYuan，禁止直接把分值拼进模板。
 */

/** 分 → 元展示字符串（固定两位小数），如 1990 → "19.90" */
export function fenToYuan(fen: number): string {
  return (fen / 100).toFixed(2);
}

/** 元 → 整数分，如 19.9 → 1990（当前无金额输入点，预留给表单/调试） */
export function yuanToFen(yuan: number): number {
  return Math.round(yuan * 100);
}
