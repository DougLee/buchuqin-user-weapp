# 不出寝食社用户端小程序

uni-app + Vue 3 + TypeScript + Pinia 实现的用户端 MVP，默认校园为湖北工业大学。

## 本地运行

先启动相邻目录中的 API：

```bash
cd ../buchuqinshishe-api
pnpm start:dev
```

再构建微信小程序：

```bash
pnpm install
pnpm dev:mp-weixin
```

使用微信开发者工具导入 `dist/dev/mp-weixin`。本地联调时需在开发者工具中勾选“不校验合法域名”。生产环境请修改 `src/api/request.ts` 的 API 域名。

## 页面

- 品牌首页、分类搜索、商品详情
- 购物袋、确认订单、Mock 支付
- 订单列表、两段履约轨迹
- 个人中心、寝室地址、优惠券

设计规范保存在 `design-system/不出寝食社/MASTER.md`，实现采用品牌橙红与奶油色覆盖，并遵循 44px 触控目标、明确加载反馈和高对比文字规则。
