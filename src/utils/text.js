/**
 * 文本处理工具
 * 提供简单的中文分词、关键词提取等能力
 * 零第三方依赖，采用基于字符 n-gram 的轻量策略
 */

// 中英文标点及空白字符，用于切分
const SPLIT_PATTERN = /[\s，。、；：""''（）《》!?,.\-—_=+\/\\|[\]{}()<>`~·！？；：""''、]/;

/**
 * 将文本切分为短语数组（中英文混合友好）
 * @param {string} text 原始文本
 * @returns {string[]} 切分后的短语
 */
function tokenize(text) {
  if (!text) return [];
  return text
    .split(SPLIT_PATTERN)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/**
 * 从问题中提取关键词
 * 策略：先按标点切分，再提取 2-4 字的中文子串 + 完整英文单词
 * @param {string} question 用户问题
 * @returns {string[]} 关键词数组（已去重）
 */
function extractKeywords(question) {
  if (!question) return [];
  const phrases = tokenize(question);
  const keywords = new Set();

  for (const phrase of phrases) {
    // 英文单词：直接加入（转小写统一）
    if (/^[a-zA-Z]+$/.test(phrase)) {
      keywords.add(phrase.toLowerCase());
      continue;
    }
    // 中文及混合：提取所有 2/3/4 字的滑动窗口
    const maxLen = Math.min(phrase.length, 4);
    for (let len = 2; len <= maxLen; len++) {
      for (let i = 0; i <= phrase.length - len; i++) {
        keywords.add(phrase.slice(i, i + len));
      }
    }
  }

  return [...keywords];
}

/**
 * 计算一段文本包含的关键词命中数量
 * @param {string} text 待检测文本
 * @param {string[]} keywords 关键词列表
 * @returns {number} 命中数量
 */
function countHits(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return 0;
  const lowerText = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lowerText.includes(kw.toLowerCase())) hits++;
  }
  return hits;
}

module.exports = {
  tokenize,
  extractKeywords,
  countHits,
};
