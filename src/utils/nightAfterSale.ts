/**
 * 夜宵售后类型枚举（IKSW1F）：与后端 NightAfterSaleDto 的 IsIn 约束
 * 严格一一对应（多/少/错任意一项服务端 400）。与白天售后常量分文件
 * 维护——夜宵一期轻量只收文字，文案口径独立演进。
 */
export const NIGHT_AFTER_SALE_TYPES: ReadonlyArray<readonly [string, string]> =
  [
    ["quality", "质量问题"],
    ["missing", "缺货少送"],
    ["damaged", "包装破损"],
    ["wrong", "错发商品"],
    ["other", "其他"],
  ];
