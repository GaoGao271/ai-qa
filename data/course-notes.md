# Node.js 入门课程笔记

## 第一章：Node.js 简介

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行时环境，它让 JavaScript 可以脱离浏览器在服务器端运行。Node.js 采用事件驱动、非阻塞 I/O 模型，适合处理高并发请求。

### 核心特点
- 事件驱动：通过事件循环机制处理请求
- 非阻塞 I/O：文件读写、网络请求不会阻塞主线程
- 单线程：主线程单线程运行，通过事件循环实现并发
- 跨平台：支持 Windows、macOS、Linux

## 第二章：模块化

Node.js 使用 CommonJS 模块系统，每个文件就是一个独立模块。

### 导出与导入
使用 `module.exports` 导出，使用 `require()` 导入。例如：
```js
// math.js
module.exports = { add: (a, b) => a + b };

// app.js
const math = require('./math');
console.log(math.add(1, 2));
```

### 内置模块
Node.js 提供了丰富的内置模块，常用的有：
- `fs`：文件系统操作
- `http` / `https`：创建网络服务
- `path`：处理文件路径
- `url`：解析 URL
- `querystring`：查询字符串解析

## 第三章：HTTP 服务

使用内置 `http` 模块可以快速创建 HTTP 服务器。

### 创建服务器示例
```js
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('你好，世界！');
});
server.listen(3000);
```

### 请求处理
- `req.method`：请求方法（GET、POST 等）
- `req.url`：请求路径
- `req.headers`：请求头
- POST 请求体需要通过 `data` / `end` 事件手动拼接

## 第四章：文件操作

`fs` 模块提供同步和异步两种操作方式，推荐使用异步版本避免阻塞事件循环。

### 读取文件
```js
const fs = require('fs');
fs.readFile('notes.md', 'utf-8', (err, data) => {
  if (err) throw err;
  console.log(data);
});
```

### Promise 版本
Node.js 内置 `fs/promises`，可以用 async/await 写法：
```js
const fs = require('fs/promises');
const data = await fs.readFile('notes.md', 'utf-8');
```

## 第五章：事件循环

事件循环是 Node.js 实现非阻塞 I/O 的核心机制，它按阶段依次处理：
1. **timers**：setTimeout、setInterval
2. **pending callbacks**：系统级回调
3. **idle / prepare**：内部使用
4. **poll**：等待新的 I/O 事件
5. **check**：setImmediate
6. **close callbacks**：socket.on('close')

### 微任务优先级
每个阶段结束后会清空微任务队列（Promise.then、process.nextTick），其中 `process.nextTick` 优先级高于 `Promise.then`。

## 第六章：环境变量

通过 `process.env` 可以读取系统环境变量。推荐将配置项（如 API Key）放在环境变量中，不要硬编码到源码。

常用的环境管理方式：
- 直接在命令行设置：`PORT=3000 node app.js`
- .env 文件配合 dotenv（生产环境建议手动设置）

## 第七章：错误处理

### try-catch 捕获同步错误
```js
try {
  JSON.parse('invalid');
} catch (err) {
  console.error('解析失败:', err.message);
}
```

### Promise 错误
必须有 `.catch()` 或在 async 函数中用 try-catch，否则会触发 `unhandledRejection`。

### 进程级兜底
```js
process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});
```

## 第八章：性能与最佳实践

1. **不要阻塞事件循环**：避免在主线程执行 CPU 密集型任务，可使用 worker_threads
2. **合理使用流**：大文件读写用 Stream，避免一次性加载到内存
3. **连接池复用**：数据库和 HTTP 客户端尽量复用连接
4. **超时保护**：所有外部调用都应设置超时
5. **日志记录**：生产环境要有完善的日志，推荐结构化 JSON 格式
6. **优雅退出**：监听 SIGTERM 信号，完成正在处理的请求后再退出
