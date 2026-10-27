/**
 * 课程资料检索服务
 * 从 data/course-notes.md 中按关键词匹配找出最相关的段落
 */

const fs = require('fs');
const path = require('path');
const { extractKeywords, countHits } = require('../utils/text');

// 课程资料文件路径（相对于项目根目录）
const NOTES_PATH = path.resolve(__dirname, '../../data/course-notes.md');

// 段落缓存，避免每次都重新读取文件
let paragraphCache = null;

/**
 * 将 Markdown 课程资料切分为段落数组
 * 规则：以空行分隔每个段落，标题行也作为独立段落保留
 * @returns {string[]} 段落数组
 */
function loadParagraphs() {
  if (paragraphCache) return paragraphCache;

  if (!fs.existsSync(NOTES_PATH)) {
    console.warn(`[检索] 课程资料文件不存在: ${NOTES_PATH}`);
    paragraphCache = [];
    return paragraphCache;
  }

  const content = fs.readFileSync(NOTES_PATH, 'utf-8');
  // 按空行切分，过滤过短的内容
  paragraphCache = content
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);

  console.log(`[检索] 已加载 ${paragraphCache.length} 个段落`);
  return paragraphCache;
}

/**
 * 检索与问题最相关的课程段落
 * @param {string} question 用户问题
 * @param {number} topN 返回前 N 条，默认 3
 * @returns {{ content: string; score: number }[]} 相关段落及命中分
 */
function retrieve(question, topN = 3) {
  const paragraphs = loadParagraphs();
  if (paragraphs.length === 0) return [];

  const keywords = extractKeywords(question);
  if (keywords.length === 0) return [];

  // 为每个段落计算命中分
  const scored = paragraphs.map((content) => ({
    content,
    score: countHits(content, keywords),
  }));

  // 按分数降序，过滤掉 0 命中的
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((p) => p.score > 0).slice(0, topN);
}

/**
 * 将检索到的段落格式化为适合喂给大模型的文本
 * @param {{ content: string; score: number }[]} results 检索结果
 * @returns {string} 拼接后的上下文文本
 */
function formatContext(results) {
  if (!results || results.length === 0) return '';
  return results
    .map((r, i) => `[参考资料${i + 1}]\n${r.content}`)
    .join('\n\n');
}

/** 清除段落缓存（资料更新后可调用） */
function invalidateCache() {
  paragraphCache = null;
}

module.exports = {
  retrieve,
  formatContext,
  invalidateCache,
  getParagraphCount: () => loadParagraphs().length,
};
