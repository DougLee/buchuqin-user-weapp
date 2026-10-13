import assert from "node:assert/strict";
import test from "node:test";

import {
  applyWeappBrandToManifest,
  applyWeappBrandToPages,
  getWeappBrand,
  weappOutputDir,
} from "./weapp-brands.mjs";

test("each mini program has an independent app id", () => {
  const buchuqin = getWeappBrand("buchuqin");
  const xiaoman = getWeappBrand("xiaoman");

  assert.equal(buchuqin.appId, "wxc814687e5ae26924");
  assert.equal(xiaoman.appId, "wxf2e90f96bcc32dd1");
  assert.notEqual(buchuqin.appId, xiaoman.appId);
});

test("global navigation title follows the selected brand", () => {
  const pages = applyWeappBrandToPages(
    `{"globalStyle":{"navigationBarTitleText":"不出寝食社"}}`,
    "xiaoman",
  );

  assert.match(pages, /"navigationBarTitleText":"小满优选"/);
  assert.equal(pages.includes("不出寝食社"), false);
});

test("dev and build outputs are isolated by brand", () => {
  assert.equal(
    weappOutputDir("/workspace", "dev", "buchuqin"),
    "/workspace/dist/dev/mp-weixin-buchuqin",
  );
  assert.equal(
    weappOutputDir("/workspace", "build", "xiaoman"),
    "/workspace/dist/build/mp-weixin-xiaoman",
  );
});

test("unknown brand fails before compiling", () => {
  assert.throws(() => getWeappBrand("unknown"), /未知小程序品牌/);
});

test("brand metadata is applied before uni compiles the manifest", () => {
  const source = `{"name":"不出寝食社","appid":"wxc814687e5ae26924","mp-weixin":{"appid":"wxc814687e5ae26924"}}`;
  const manifest = applyWeappBrandToManifest(source, "xiaoman");

  assert.match(manifest, /"name":"小满优选"/);
  assert.equal(manifest.includes("wxc814687e5ae26924"), false);
  assert.equal(manifest.match(/wxf2e90f96bcc32dd1/g)?.length, 2);
});
