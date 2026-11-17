/**
 * AI 答疑助手 —— 服务启动入口
 *
 * 使用 Node.js 内置 http 模块起服务，零第三方依赖
 * 路由：
 *   POST /ask      提问接口
 *   GET  /records  历史问答
 *   GET  /status   服务状态 / 健康检查
 *   /*             静态文件（public/ 目录）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { handleAsk, handleRecords, handleStatus } = require('./routes/ask');

// 端口：环境变量或默认 3000
const PORT = parseInt(process.env.PORT || '3000', 10);
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// 常见 MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

/**
 * 解析请求体（JSON）
 * @param {http.IncomingMessage} req
 * @returns {Promise<any>} 解析后的对象；非 JSON 或空 body 返回 null
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8');
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error(`JSON 解析失败: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 发送 JSON 响应
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * 提供静态文件服务
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @param {string} urlPath 请求路径
 */
function serveStatic(req, res, urlPath) {
  // 根路径默认返回 index.html
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  // path.normalize 在 Windows 上会把前导 / 变成 \，这里统一去掉所有前导斜杠
  filePath = path.normalize(filePath).replace(/^[\\/]+/, '');

  // 安全检查：禁止跳出 public 目录
  const fullPath = path.resolve(PUBLIC_DIR, filePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { code: 'FORBIDDEN', message: '禁止访问' });
  }

  fs.stat(fullPath, (err, stat) => {
    if (err || !stat.isFile()) {
      // 找不到文件 → 返回 index.html（方便前端路由 fallback）
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(indexPath)) {
        return fs.readFile(indexPath, (e, data) => {
          if (e) return sendJson(res, 404, { code: 'NOT_FOUND', message: '页面未找到' });
          res.writeHead(200, { 'Content-Type': MIME['.html'] });
          res.end(data);
        });
      }
      return sendJson(res, 404, { code: 'NOT_FOUND', message: '页面未找到' });
    }

    const ext = path.extname(fullPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
    });
    fs.createReadStream(fullPath).pipe(res);
  });
}

/**
 * 请求分发器
 */
async function dispatch(req, res) {
  // 配置 CORS（方便本地开发直接跨域调试）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  // OPTIONS 预检请求直接放行
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  const pathname = urlObj.pathname;

  try {
    // 路由分发
    if (req.method === 'POST' && pathname === '/ask') {
      const body = await readBody(req);
      const result = await handleAsk({ body });
      return sendJson(res, result.status, result.body);
    }

    if (req.method === 'GET' && pathname === '/records') {
      const result = handleRecords();
      return sendJson(res, result.status, result.body);
    }

    if (req.method === 'GET' && pathname === '/status') {
      const result = handleStatus();
      return sendJson(res, result.status, result.body);
    }

    // 其他路径当作静态资源
    return serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server] 处理请求异常:', err);
    return sendJson(res, 500, {
      code: 'INTERNAL_ERROR',
      message: err.message || '服务器内部错误',
    });
  }
}

/**
 * 创建 HTTP 服务实例（不监听端口）
 * 供单元/集成测试复用，避免测试时占用端口
 * @returns {http.Server}
 */
function createServer() {
  return http.createServer((req, res) => {
    dispatch(req, res).catch((err) => {
      console.error('[server] 未捕获异常:', err);
      sendJson(res, 500, { code: 'INTERNAL_ERROR', message: err.message });
    });
  });
}

/**
 * 启动服务并注册优雅退出
 * @param {number} [port]
 * @returns {http.Server}
 */
function start(port = PORT) {
  const server = createServer();

  server.listen(port, () => {
    const demoMode = !process.env.LLM_API_KEY;
    console.log('\n========================================');
    console.log('  AI 答疑助手 启动成功');
    console.log(`  地址: http://localhost:${port}`);
    console.log(`  演示模式: ${demoMode ? '是（未配置 LLM_API_KEY）' : '否'}`);
    console.log('  接口: POST /ask   GET /records   GET /status');
    console.log('========================================\n');
  });

  // 优雅退出
  function gracefulShutdown() {
    console.log('\n[server] 正在关闭...');
    server.close(() => {
      console.log('[server] 已退出');
      process.exit(0);
    });
    // 超时强退
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);

  return server;
}

// 仅在直接运行时监听端口，被 require 时不启动
if (require.main === module) {
  start();
}

module.exports = {
  createServer,
  start,
};
