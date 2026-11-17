/**
 * 集成测试：src/server.js 暴露的 HTTP 接口
 *
 * 覆盖范围：
 *   GET  /status   健康检查（演示模式标识）
 *   POST /ask      参数校验、正常问答、非法 JSON
 *   GET  /records  历史记录读取与倒序
 *   GET  /         静态页面服务
 *
 * 隔离策略：
 *   1. 通过 QA_RECORDS_PATH 把记录文件指向系统临时目录，不污染项目根目录的 qa-records.json；
 *   2. 不监听固定端口，直接使用 createServer() 返回的实例交给 supertest 驱动；
 *   3. 清除 LLM_API_KEY，强制走演示模式，避免真实网络请求。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let app
let tmpDir
let recordsPath
const originalApiKey = process.env.LLM_API_KEY

beforeAll(async () => {
  // 临时目录 + 临时记录文件，保证测试数据与真实数据隔离
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aiqa-test-'))
  recordsPath = path.join(tmpDir, 'qa-records.json')
  process.env.QA_RECORDS_PATH = recordsPath

  // 强制演示模式：不发起真实大模型请求
  delete process.env.LLM_API_KEY

  // 动态导入，确保 qaRecord 在环境变量设置之后才读取记录路径
  const { createServer } = await import('../src/server')
  app = createServer()
})

beforeEach(() => {
  // 每个用例开始前清空临时记录文件
  fs.writeFileSync(recordsPath, '[]', 'utf-8')
})

afterAll(() => {
  // 还原环境变量并清理临时目录
  if (originalApiKey === undefined) delete process.env.LLM_API_KEY
  else process.env.LLM_API_KEY = originalApiKey
  delete process.env.QA_RECORDS_PATH
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('GET /status 服务状态', () => {
  it('未配置 LLM_API_KEY 时返回演示模式', async () => {
    // 预期：200 + code OK + demoMode=true + hasKey=false
    const res = await request(app).get('/status')

    expect(res.status).toBe(200)
    expect(res.body.code).toBe('OK')
    expect(res.body.data.demoMode).toBe(true)
    expect(res.body.data.hasKey).toBe(false)
  })
})

describe('POST /ask 提问接口', () => {
  it('question 为空时返回 400 INVALID_PARAM', async () => {
    // 预期：参数校验失败，不产生记录
    const res = await request(app).post('/ask').send({ question: '   ' })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_PARAM')
    expect(res.body.data).toBeNull()
  })

  it('question 超过 500 字时返回 400 INVALID_PARAM', async () => {
    // 预期：长度校验生效，提示控制在 500 字以内
    const res = await request(app).post('/ask').send({ question: 'a'.repeat(501) })

    expect(res.status).toBe(400)
    expect(res.body.code).toBe('INVALID_PARAM')
    expect(res.body.message).toContain('500')
  })

  it('演示模式下正常问答，返回答案并落库', async () => {
    // 预期：200 + code OK + answer 非空 + demoMode=true + recordId 存在
    const question = 'Node.js 事件循环的微任务优先级是怎样的？'
    const res = await request(app).post('/ask').send({ question })

    expect(res.status).toBe(200)
    expect(res.body.code).toBe('OK')
    expect(res.body.data.answer).toContain('演示模式')
    expect(res.body.data.demoMode).toBe(true)
    expect(res.body.data.recordId).toBeTruthy()
    expect(Array.isArray(res.body.data.sources)).toBe(true)

    // 记录已写入临时文件，并能通过 /records 读回
    const records = await request(app).get('/records')
    expect(records.body.data).toHaveLength(1)
    expect(records.body.data[0].id).toBe(res.body.data.recordId)
    expect(records.body.data[0].question).toBe(question)
  })

  it('请求体不是合法 JSON 时返回 500 INTERNAL_ERROR', async () => {
    // 预期：JSON 解析异常被统一错误处理捕获
    const res = await request(app)
      .post('/ask')
      .set('Content-Type', 'application/json')
      .send('{not-a-json')

    expect(res.status).toBe(500)
    expect(res.body.code).toBe('INTERNAL_ERROR')
  })
})

describe('GET /records 历史记录', () => {
  it('无记录时返回空数组', async () => {
    // 预期：data 为空数组，而不是 null
    const res = await request(app).get('/records')

    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('多次提问后按最新创建在前返回', async () => {
    // 预期：data[0] 是后一次提问，data[1] 是前一次提问
    await request(app).post('/ask').send({ question: '第一个问题' })
    // 等待 2ms，避免两条记录 createdAt 落在同一毫秒导致排序断言不稳定
    await new Promise((resolve) => setTimeout(resolve, 2))
    await request(app).post('/ask').send({ question: '第二个问题' })

    const res = await request(app).get('/records')

    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].question).toBe('第二个问题')
    expect(res.body.data[1].question).toBe('第一个问题')
  })
})

describe('静态资源服务', () => {
  it('GET / 返回 index.html 页面', async () => {
    // 预期：200 + text/html，且包含提问输入框的测试锚点
    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(res.text).toContain('data-testid="ask-input"')
  })
})
