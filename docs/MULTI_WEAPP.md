# 一套源码构建多个微信小程序

源码只维护一份。构建脚本会为每个品牌生成隔离的 manifest 输入目录，每个品牌使用独立名称、AppID 和输出目录；微信开发者工具导入编译目录，不导入源码根目录。

## 开发构建（连接测试 API）

```bash
pnpm dev:mp-weixin:buchuqin
pnpm dev:mp-weixin:xiaoman
```

对应导入目录：

- 不出寝食社：`dist/dev/mp-weixin-buchuqin`
- 小满优选：`dist/dev/mp-weixin-xiaoman`

两个命令可以在两个终端同时运行，输出目录互不覆盖。

## 正式构建（连接生产 API）

```bash
pnpm build:mp-weixin:buchuqin
pnpm build:mp-weixin:xiaoman
```

对应上传目录：

- 不出寝食社：`dist/build/mp-weixin-buchuqin`
- 小满优选：`dist/build/mp-weixin-xiaoman`

## API 地址

- `dev` 默认：`https://admin-test.buchuqin.com/api/v1`
- `build` 默认：`https://admin.buchuqin.com/api/v1`

临时覆盖地址时，在命令前传入 `VITE_API_BASE_URL`：

```bash
VITE_API_BASE_URL=https://admin-test.buchuqin.com/api/v1 pnpm build:mp-weixin:xiaoman
```

## 增加新小程序

在 `scripts/weapp-brands.mjs` 增加品牌键、名称和 AppID，再在 `package.json` 增加对应的 dev/build 命令。服务端“组织管理”中必须给该组织配置相同的 AppID 和正确的 AppSecret；不同组织不能复用 AppID。
