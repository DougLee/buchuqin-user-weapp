import path from "node:path";

const TEST_API = "https://admin-test.buchuqin.com/api/v1";
const PRODUCTION_API = "https://admin.buchuqin.com/api/v1";

export const WEAPP_BRANDS = Object.freeze({
  buchuqin: Object.freeze({
    name: "不出寝食社",
    appId: "wxc814687e5ae26924",
  }),
  xiaoman: Object.freeze({
    name: "小满优选",
    appId: "wx084a587b78b1074a",
  }),
  daxiong: Object.freeze({
    name: "大雄零食",
    appId: "wxacd195fb4fdf6c4a",
  }),
});

export function getWeappBrand(key) {
  const brand = WEAPP_BRANDS[key];
  if (!brand) {
    throw new Error(
      `未知小程序品牌: ${key || "(空)"}；可选值：${Object.keys(WEAPP_BRANDS).join(", ")}`,
    );
  }
  return brand;
}

export function weappOutputDir(rootDir, command, brandKey) {
  const stage = command === "dev" ? "dev" : "build";
  return path.resolve(rootDir, "dist", stage, `mp-weixin-${brandKey}`);
}

export function weappEnvironment(command, brandKey, currentEnv = process.env) {
  const brand = getWeappBrand(brandKey);
  return {
    ...currentEnv,
    VITE_APP_NAME: brand.name,
    VITE_WECHAT_APP_ID: brand.appId,
    VITE_API_BASE_URL:
      currentEnv.VITE_API_BASE_URL ||
      (command === "dev" ? TEST_API : PRODUCTION_API),
  };
}

export function applyWeappBrandToManifest(source, brandKey) {
  const brand = getWeappBrand(brandKey);
  return source
    .replace(/("name"\s*:\s*)"[^"]*"/, `$1"${brand.name}"`)
    .replace(/wxc814687e5ae26924/g, brand.appId);
}

export function applyWeappBrandToPages(source, brandKey) {
  const brand = getWeappBrand(brandKey);
  return source.replace(
    /(\"navigationBarTitleText\"\s*:\s*)\"不出寝食社\"/g,
    `$1\"${brand.name}\"`,
  );
}
