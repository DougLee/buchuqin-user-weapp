import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';

/** This plugin is development middleware only; it is absent from the built H5/MP. */
export function nightPreviewPayPlugin({ apiTarget }) {
  return { name: 'local-night-preview-payment', apply: 'serve', configureServer(server) {
    server.middlewares.use('/__night-preview/pay', (req, res) => {
      const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
      const origin = req.headers.origin;
      if (!local || !['http://localhost:3150', 'http://127.0.0.1:3150'].includes(apiTarget) || (origin && origin !== `http://${req.headers.host}`)) { res.statusCode = 404; res.end(); return; }
      if (req.method !== 'POST' || !req.headers['content-type']?.includes('application/json')) { res.statusCode = 405; res.end(); return; }
      let body = '';
      req.on('data', chunk => { body += chunk; if (body.length > 2048) req.destroy(); });
      req.on('end', () => {
        let orderId;
        try { orderId = JSON.parse(body).orderId; } catch { res.statusCode = 400; res.end(); return; }
        if (!/^[a-zA-Z0-9_-]{1,100}$/.test(orderId || '')) { res.statusCode = 400; res.end(); return; }
        const apiRoot = fileURLToPath(new URL('../../buchuqin-api/', import.meta.url));
        execFile(process.execPath, [path.join(apiRoot, 'scripts/night-preview-confirm.mjs'), orderId, 'user'], { cwd: apiRoot, timeout: 20000 }, error => {
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.statusCode = error ? 400 : 200;
          res.end(JSON.stringify(error ? { message: '本机模拟确认失败，请检查订单状态与隔离API' } : { localSimulation: true, confirmed: true }));
        });
      });
    });
  } };
}
