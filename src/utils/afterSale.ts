/**
 * 售后类型枚举（IK9AWS）：快捷弹窗与申请页两处入口共用一套口径。
 * 后端 AfterSale.type 为自由字符串，收敛校验后以此清单为准。
 */
export const AFTER_SALE_TYPES: ReadonlyArray<readonly [string, string]> = [
  ["quality", "质量问题"],
  ["missing", "商品缺失"],
  ["damaged", "包装破损"],
  ["wrong", "错发商品"],
  ["other", "其他"],
];
