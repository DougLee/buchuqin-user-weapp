import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  applyWeappBrandToManifest,
  applyWeappBrandToPages,
  getWeappBrand,
  weappEnvironment,
  weappOutputDir,
} from "./weapp-brands.mjs";

const command = process.argv[2];
const brandKey = process.argv[3];
if (!["dev", "build"].includes(command)) {
  throw new Error(`构建类型必须是 dev 或 build，当前为：${command || "(空)"}`);
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const brand = getWeappBrand(brandKey);
const outputDir = weappOutputDir(rootDir, command, brandKey);
const sourceDir = path.join(rootDir, "src");
const brandInputDir = path.join(rootDir, ".cache", "weapp-input", brandKey);
const projectConfigPath = path.join(outputDir, "project.config.json");

function prepareBrandInput() {
  // 目录仅包含生成内容；每次重建可避免源码已删除时残留旧软链接。
  fs.rmSync(brandInputDir, { recursive: true, force: true });
  fs.mkdirSync(brandInputDir, { recursive: true });
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const destination = path.join(brandInputDir, entry.name);
    if (entry.name === "manifest.json" || entry.name === "pages.json") {
      const source = fs.readFileSync(path.join(sourceDir, entry.name), "utf8");
      fs.writeFileSync(
        destination,
        entry.name === "manifest.json"
          ? applyWeappBrandToManifest(source, brandKey)
          : applyWeappBrandToPages(source, brandKey),
      );
      continue;
    }
    if (fs.existsSync(destination)) continue;
    const source = path.join(sourceDir, entry.name);
    if (entry.isDirectory()) {
      fs.symlinkSync(
        source,
        destination,
        process.platform === "win32" ? "junction" : undefined,
      );
    } else if (process.platform === "win32") {
      // Windows 普通用户通常不能创建文件软链接，硬链接无需管理员权限。
      try {
        fs.linkSync(source, destination);
      } catch {
        fs.copyFileSync(source, destination);
      }
    } else {
      fs.symlinkSync(source, destination);
    }
  }
}

prepareBrandInput();
const environment = {
  ...weappEnvironment(command, brandKey),
  UNI_INPUT_DIR: brandInputDir,
  UNI_OUTPUT_DIR: outputDir,
};

function patchProjectConfig() {
  try {
    if (!fs.existsSync(projectConfigPath)) return false;
    const config = JSON.parse(fs.readFileSync(projectConfigPath, "utf8"));
    if (config.appid === brand.appId && config.projectname === brand.name) {
      return true;
    }
    config.appid = brand.appId;
    config.projectname = brand.name;
    const temporaryPath = `${projectConfigPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporaryPath, `${JSON.stringify(config, null, 2)}\n`);
    try {
      fs.renameSync(temporaryPath, projectConfigPath);
    } catch (error) {
      if (
        process.platform !== "win32" ||
        !["EEXIST", "EPERM"].includes(error?.code)
      ) {
        throw error;
      }
      // Windows 可能不允许 rename 覆盖现有文件，降级为覆盖复制。
      fs.copyFileSync(temporaryPath, projectConfigPath);
      fs.unlinkSync(temporaryPath);
    }
    return true;
  } catch (error) {
    // dev 编译器可能正好在重写文件；轮询下一次会继续校准。
    if (error instanceof SyntaxError || error?.code === "ENOENT") return false;
    console.error(`[微信小程序] 更新 project.config.json 失败：${error.message}`);
    return false;
  }
}

console.log(`\n[微信小程序] ${brand.name} (${brand.appId})`);
console.log(`[API] ${environment.VITE_API_BASE_URL}`);
console.log(`[输出目录] ${outputDir}\n`);

const uniBin = path.join(
  rootDir,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "uni.cmd" : "uni",
);
const args = command === "dev" ? ["-p", "mp-weixin"] : ["build", "-p", "mp-weixin"];
const child = spawn(uniBin, args, {
  cwd: rootDir,
  env: environment,
  stdio: "inherit",
});

// dev 首次编译及后续重编译都可能重写 project.config.json，持续校准品牌信息。
const timer = setInterval(patchProjectConfig, 300);
child.on("exit", (code, signal) => {
  clearInterval(timer);
  const patched = patchProjectConfig();
  process.exitCode = signal || code !== 0 || !patched ? code || 1 : 0;
});
child.on("error", (error) => {
  clearInterval(timer);
  console.error(`[微信小程序] 无法启动 uni 编译器：${error.message}`);
  process.exitCode = 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
