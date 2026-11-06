import fs from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

/** Local-only fixture login; production builds never expose this middleware. */
export function nightUserPreviewLoginPlugin({ apiTarget, sessionPath = "/tmp/night-stock-preview.json", secretPath = "/tmp/night-stock-preview-secret" }) {
  return {
    name: "local-night-user-preview-login", apply: "serve",
    configureServer(server) {
      if (["http://localhost:3150", "http://127.0.0.1:3150"].includes(apiTarget)) server.middlewares.use((req, res, next) => {
        // Local preview cannot fetch production APIs, CDN images or native payment gateways.
        res.setHeader("Content-Security-Policy", "default-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: ws://localhost:* ws://127.0.0.1:* http://localhost:3150 http://127.0.0.1:3150; img-src 'self' data: blob: http://localhost:3150 http://127.0.0.1:3150; frame-src 'none'");
        next();
      });
      server.middlewares.use("/__night-preview/start", (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        const local = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
        if (!local || !["http://localhost:3150", "http://127.0.0.1:3150"].includes(apiTarget)) { res.statusCode = 404; res.end("仅本机独立夜宵预览可用"); return; }
        if (req.method !== "GET") { res.statusCode = 405; res.end("请使用GET打开预览"); return; }
        try {
          const fixture = JSON.parse(fs.readFileSync(sessionPath, "utf8")), secret = fs.readFileSync(secretPath, "utf8").trim();
          if (fixture.campusId !== "night-preview-campus" || fixture.staffId !== "night-preview-staff" || !/^[a-f0-9]{96}$/.test(secret)) throw Error("invalid preview");
          const encode = x => Buffer.from(JSON.stringify(x)).toString("base64url"), now = Math.floor(Date.now() / 1000);
          const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ id: "night-demo-customer-0", campusId: fixture.campusId, role: "user", appKind: "user", iat: now, exp: now + 86400 })}`;
          const token = `${unsigned}.${createHmac("sha256", secret).update(unsigned).digest("base64url")}`, nonce = randomBytes(18).toString("base64url");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; frame-ancestors 'none'`);
          res.end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>本机夜宵用户预览</title><body>正在进入独立测试校区…<script nonce="${nonce}">
localStorage.setItem('token',${JSON.stringify(token)});
localStorage.setItem('selectedCampusId','night-preview-campus');
localStorage.setItem('nightBuildingId','night-preview-building');
location.replace('/h5/user/m/#/pages/night/buildings');
</script></body></html>`);
        } catch { res.statusCode = 503; res.end("请先启动3150独立夜宵预览API并准备用户夹具"); }
      });
    },
  };
}
