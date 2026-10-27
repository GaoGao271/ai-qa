/**
 * 大模型调用服务
 * 走兼容 OpenAI 的 Chat Completions 协议
 * 未配置 LLM_API_KEY 时自动进入演示模式，返回预设回答
 */

const TIMEOUT_MS = 30_000; // 单次请求超时 30 秒
const DEMO_MODE_MESSAGE = '演示模式（未配置 LLM_API_KEY）';

/**
 * 判断当前是否处于演示模式
 * @returns {boolean}
 */
function isDemoMode() {
  return !process.env.LLM_API_KEY || process.env.LLM_API_KEY.trim() === '';
}

/**
 * 构造演示模式下的预设回答
 * 会把检索到的课程资料内容简要总结后返回，保证完整链路可测试
 * @param {string} question 用户问题
 * @param {string} context 检索到的课程资料上下文
 * @returns {string} 演示回答
 */
function buildDemoAnswer(question, context) {
  const header = `【${DEMO_MODE_MESSAGE}】\n`;
  const questionPart = `\u{1F4DD} 你的问题：${question}\n`;

  if (context && context.trim().length > 0) {
    return (
      header +
      questionPart +
      '\n已从课程资料中检索到相关内容，以下是资料摘要：\n\n' +
      context.slice(0, 800) +
      '\n\n---\n💡 配置 LLM_API_KEY 后，将由真实大模型生成更精准的回答。'
    );
  }

  return (
    header +
    questionPart +
    '\n课程资料中未检索到直接相关的段落。\n' +
    '💡 配置 LLM_API_KEY 后，将由真实大模型结合课程资料生成回答。'
  );
}

/**
 * 调用兼容 OpenAI 协议的大模型接口
 * @param {string} question 用户问题
 * @param {string} context 检索到的课程资料（可为空）
 * @returns {Promise<{ answer: string; demoMode: boolean; error?: string }>}
 */
async function askLLM(question, context) {
  // 演示模式：不发起任何网络请求
  if (isDemoMode()) {
    console.log(`[LLM] ${DEMO_MODE_MESSAGE}`);
    return {
      answer: buildDemoAnswer(question, context),
      demoMode: true,
    };
  }

  const apiKey = process.env.LLM_API_KEY.trim();
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL || 'gpt-4o-mini';

  // 构造系统提示词，引导模型结合资料回答
  const systemPrompt = [
    '你是一个专业的 Node.js 课程答疑助手。',
    '请优先基于用户提供的「参考资料」回答问题；如果资料中没有相关内容，再用你自己的知识补充，并明确标注。',
    '回答使用中文，结构清晰，适当使用代码块。',
    '如果问题与编程无关，礼貌说明你只回答 Node.js 相关的课程问题。',
  ].join('');

  const userContent = context
    ? `【参考资料】\n${context}\n\n【用户问题】\n${question}`
    : `【用户问题】\n${question}\n\n（课程资料中未检索到相关内容，请基于你的知识回答）`;

  const body = JSON.stringify({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
    temperature: 0.3,
    max_tokens: 2048,
  });

  const url = `${baseUrl}/chat/completions`;
  console.log(`[LLM] 请求 ${url}，模型 ${model}`);

  // 使用 AbortController 做超时保护（Node 18+ 原生 fetch 支持）
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`HTTP ${response.status}: ${errText || response.statusText}`);
    }

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      throw new Error('大模型返回内容为空');
    }

    console.log(`[LLM] 成功，回答长度 ${answer.length} 字`);
    return { answer, demoMode: false };
  } catch (err) {
    const msg =
      err.name === 'AbortError'
        ? `请求超时（${TIMEOUT_MS / 1000} 秒）`
        : err.message || '未知错误';
    console.error(`[LLM] 调用失败: ${msg}`);
    return {
      answer: '',
      demoMode: false,
      error: msg,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  askLLM,
  isDemoMode,
  TIMEOUT_MS,
};
