# 不出寝食社用户端小程序 API 清单

> 适用项目：`buchuqinshishe-userweapp`  
> 范围：用户端 MVP（首页 → 商品 → 购物车 → 结算 → 支付 → 订单跟踪 → 售后）  
> 状态标记：`已接入` 表示当前前端已有调用；`待补充` 表示根据页面完整功能仍需增加。

## 1. 通用约定

- Base URL：`/api`（本地开发代理到 NestJS 服务）。
- 鉴权：除登录外使用 `Authorization: Bearer <token>`。
- 服务端必须从 Token 注入 `userId`、`campusId`，禁止由客户端传入并作为可信身份。
- 所有用户数据按 `userId + campusId` 隔离。
- 金额统一使用“分”作为整数；当前 Mock 若继续返回元，正式接数据库前必须统一。
- 时间统一使用 ISO 8601；分页统一为 `page`、`pageSize`，返回 `items`、`total`、`page`、`pageSize`。
- 统一响应：`{ code: number, message: string, data: T, timestamp: string }`。
- 图片上传采用先上传、再提交资源 URL 的方式。

## 2. 登录与用户

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入（Mock） | POST | `/auth/mock-login` | 本地模拟登录 | `code` | `token`, `user` |
| 待补充 | POST | `/auth/wechat-login` | 微信 `code` 换取登录态 | `code` | `token`, `refreshToken`, `user`, `needsProfile` |
| 待补充 | POST | `/auth/phone` | 绑定微信手机号 | `phoneCode` | `phone`, `profileCompleted` |
| 待补充 | POST | `/auth/refresh` | 刷新访问令牌 | `refreshToken` | 新 Token |
| 待补充 | GET | `/users/me` | 获取当前用户资料 | — | 用户、手机号、默认校园、默认地址 |
| 待补充 | PATCH | `/users/me` | 修改昵称、头像等 | `nickname`, `avatarUrl` | 更新后的用户 |

## 3. 首页、校园与商品

| 状态 | 方法 | 路径 | 用途 | 查询/请求参数 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | GET | `/home` | 首页聚合数据 | — | 校园、Banner、分类、推荐商品 |
| 已实现未直连 | GET | `/campus/current` | 当前校园及营业状态 | — | 校园、仓库、服务时间、起送价 |
| 待补充 | GET | `/campuses` | 可服务校园列表 | `keyword?` | 校园列表 |
| 待补充 | PUT | `/users/me/campus` | 切换校园 | `campusId` | 当前校园；同时清理跨校园购物车 |
| 已实现未直连 | GET | `/categories` | 商品分类 | — | 分类列表 |
| 已接入 | GET | `/products` | 搜索/分类商品列表 | `categoryId?`, `keyword?`, `page`, `pageSize`, `sort?` | 商品分页 |
| 已接入 | GET | `/products/:id` | 商品详情 | — | 商品、规格、库存、限购、配送提示 |
| 待补充 | GET | `/search/suggestions` | 搜索联想与热词 | `keyword?` | 建议词、热搜词 |

商品响应至少包含：`id`、`categoryId`、`name`、`subtitle`、`price`、`originalPrice`、`stock`、`sales`、`tag`、`image`、`weight`、`saleStatus`。

## 4. 购物车

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | GET | `/cart` | 获取当前购物车 | — | 明细、商品金额、数量、起送价、失效项 |
| 已接入 | PUT | `/cart` | 批量同步购物车数量 | `items[{ productId, quantity }]` | 重算后的购物车 |
| 建议补充 | POST | `/cart/items` | 单商品加入购物车 | `productId`, `quantity` | 购物车 |
| 建议补充 | PATCH | `/cart/items/:productId` | 修改数量 | `quantity` | 购物车 |
| 建议补充 | DELETE | `/cart/items/:productId` | 删除商品 | — | 购物车 |
| 建议补充 | DELETE | `/cart` | 清空购物车 | — | 空购物车 |

写入购物车时必须校验：商品在售、所属校园、实时库存、限购数量；`quantity=0` 等同删除。

## 5. 地址与寝室绑定

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | GET | `/addresses` | 地址列表 | — | 当前用户当前校园地址 |
| 已接入 | POST | `/addresses` | 新增寝室地址 | 楼栋、楼层、寝室、联系人、手机号 | 地址 |
| 待补充 | PATCH | `/addresses/:id` | 编辑地址 | 可编辑字段 | 地址 |
| 待补充 | DELETE | `/addresses/:id` | 删除地址 | — | 删除结果 |
| 待补充 | PUT | `/addresses/:id/default` | 设置默认地址 | — | 地址 |
| 待补充 | GET | `/campuses/current/buildings` | 获取可配送楼栋 | — | 楼栋、楼层范围、配送状态 |

下单时服务端必须校验地址属于当前用户、当前校园且楼栋在服务范围内。

## 6. 配送与结算

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | GET | `/delivery/slots` | 可预约配送时段 | `date?`, `addressId?` | 时段、是否可选、剩余容量 |
| 已接入 | POST | `/orders/checkout` | 订单预结算 | `addressId`, `deliveryMode`, `deliverySlot?`, `couponId?` | 商品金额、配送费、优惠、应付、预计送达 |
| 已接入 | GET | `/coupons` | 用户优惠券列表 | `status?`, `scene?` | 优惠券列表 |
| 待补充 | GET | `/coupons/available` | 当前结算可用券 | 结算同款参数 | 可用券、不可用原因、推荐券 |

`checkout` 与创建订单必须复用同一套校验：库存、10 元起送、地址、时段容量、优惠券归属/有效期、配送费；客户端金额不能作为下单依据。

## 7. 订单与支付

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | POST | `/orders` | 创建待支付订单 | 同预结算参数，`remark?`（最多 60 字） | 订单、支付截止时间 |
| 已接入（Mock） | POST | `/orders/:id/pay` | 模拟支付 | — | 已支付订单 |
| 待补充 | POST | `/payments/wechat/prepay` | 获取微信支付参数 | `orderId` | `timeStamp`, `nonceStr`, `package`, `paySign` |
| 服务端 | POST | `/payments/wechat/notify` | 微信支付回调 | 微信回调报文 | 回调确认 |
| 待补充 | GET | `/payments/:id` | 查询支付结果 | — | 支付状态、金额、时间 |
| 已接入 | GET | `/orders` | 订单分页 | `status?`, `page`, `pageSize` | 订单分页 |
| 已接入 | GET | `/orders/:id` | 订单详情与履约轨迹 | — | 订单、地址快照、商品快照、时间线 |
| 已接入 | POST | `/orders/:id/cancel` | 取消订单 | `reasonCode?`, `reason?` | 取消/退款结果 |
| 仅开发 | POST | `/orders/:id/mock-advance` | Mock 推进履约 | — | 更新后的订单 |
| 待补充 | POST | `/orders/:id/confirm-receipt` | 用户确认收货 | — | 已完成订单 |

关键状态建议：`pending-payment → paid → picking → first-mile → last-mile → delivered/completed`；终态包括 `cancelled`、`refunded`。支付、取消、回调均需幂等；未支付订单不可进入履约。

## 8. 售后、退款与文件

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 待补充 | POST | `/files/images` | 上传售后图片 | `multipart/form-data` | `fileId`, `url` |
| 已接入 | POST | `/orders/:id/after-sales` | 发起质量售后 | `type`, `description`, `images[]` | 售后单 |
| 已接入 | GET | `/after-sales` | 售后列表 | `status?`, `page?`, `pageSize?` | 售后分页 |
| 待补充 | GET | `/after-sales/:id` | 售后详情及处理轨迹 | — | 售后详情 |
| 待补充 | POST | `/after-sales/:id/cancel` | 撤销售后 | — | 售后单 |
| 已接入 | GET | `/refunds` | 退款记录 | `page?`, `pageSize?` | 退款分页 |
| 待补充 | GET | `/refunds/:id` | 退款详情 | — | 原路退款状态及时间 |

售后规则：仅已送达订单可申请；质量问题至少一张凭证；送达后 24 小时内；同一订单/商品不得重复提交未结束售后。

## 9. 消息

| 状态 | 方法 | 路径 | 用途 | 主要请求 | 主要响应 |
|---|---|---|---|---|---|
| 已接入 | GET | `/notifications` | 消息列表 | `type?`, `read?`, `page?`, `pageSize?` | 消息分页/列表 |
| 已接入 | POST | `/notifications/:id/read` | 单条已读 | — | 消息 |
| 待补充 | POST | `/notifications/read-all` | 全部已读 | `type?` | 未读数 |
| 待补充 | GET | `/notifications/unread-count` | 获取未读数 | — | `total`, 各类型数量 |
| 待补充 | POST | `/subscriptions` | 保存微信订阅消息授权 | `templateIds[]`, `accepted[]` | 授权记录 |

## 10. MVP 上线前优先级

1. 微信登录、手机号授权、用户/校园隔离。
2. 地址编辑删除、默认地址与服务楼栋接口。
3. 微信预支付、支付回调、支付查询及 15 分钟关单。
4. 图片上传和售后 24 小时规则。
5. 订单、消息、售后的正式分页。
6. 移除客户端可调用的 `/mock-advance`，改由履约端驱动状态。

