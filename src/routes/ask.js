/**
 * /ask 接口处理
 * 串联「检索 → LLM → 存记录」完整流程
 */

const { retrieve, formatContext } = require('../services/retriever');
const { askLLM, isDemoMode } = require('../services/llm');
const qaRecord = require('../record/qaRecord');

/**
 * POST /ask 处理器
 * 期望 body: { "question": "Node.js 事件循环是什么？" }
 * @param {object} req 已解析 JSON body 的请求对象
 * @returns {Promise<{ status: number; body: object }>}
 */
async function handleAsk(req) {
  const question = (req.body?.question || '').trim();

  // 1. 参数校验
  if (!question) {
    return {
      status: 400,
      body: { code: 'INVALID_PARAM', message: 'question 不能为空', data: null },
    };
  }
  if (question.length > 500) {
    return {
      status: 400,
      body: { code: 'INVALID_PARAM', message: '问题过长，请控制在 500 字以内', data: null },
    };
  }

  console.log(`\n[ask] 收到问题: ${question}`);
  const startedAt = Date.now();

  // 2. 检索课程资料
  const hits = retrieve(question, 3);
  const context = formatContext(hits);
  console.log(`[ask] 命中段落: ${hits.length} 条`);

  // 3. 调用大模型（或演示模式）
  const { answer, demoMode, error } = await askLLM(question, context);
  const duration = Date.now() - startedAt;

  // 4. 组装检索来源片段（只留前 120 字摘要返回前端）
  const sources = hits.map((h) => h.content.replace(/\s+/g, ' ').slice(0, 120));

  // 5. 保存问答记录
  const savedRecord = qaRecord.append({
    question,
    answer: answer || '',
    demoMode,
    error,
    sources,
  });

  // 6. LLM 返回为空 → 按失败处理
  if (!answer) {
    return {
      status: 502,
      body: {
        code: 'LLM_FAILED',
        message: `大模型调用失败：${error || '返回内容为空'}`,
        data: {
          demoMode,
          durationMs: duration,
          recordId: savedRecord?.id || null,
        },
      },
    };
  }

  return {
    status: 200,
    body: {
      code: 'OK',
      message: 'success',
      data: {
        answer,
        demoMode,
        durationMs: duration,
        sources,
        recordId: savedRecord?.id || null,
      },
    },
  };
}

/**
 * GET /records 处理器：查询历史问答
 * @returns {{ status: number; body: object }}
 */
function handleRecords() {
  const list = qaRecord.readAll();
  return {
    status: 200,
    body: { code: 'OK', message: 'success', data: list },
  };
}

/**
 * GET /status 处理器：服务健康检查
 * @returns {{ status: number; body: object }}
 */
function handleStatus() {
  return {
    status: 200,
    body: {
      code: 'OK',
      message: 'service running',
      data: {
        demoMode: isDemoMode(),
        hasKey: !!process.env.LLM_API_KEY,
        model: process.env.LLM_MODEL || '(未配置)',
      },
    },
  };
}

module.exports = {
  handleAsk,
  handleRecords,
  handleStatus,
};
