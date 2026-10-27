/**
 * 问答记录读写服务
 * 所有问答以 JSON 行格式追加写入 qa-records.json
 * 读取时按时间倒序返回，方便前端展示历史列表
 */

const fs = require('fs');
const path = require('path');

// 记录文件路径（项目根目录下）
const RECORDS_PATH = path.resolve(__dirname, '../../qa-records.json');

/**
 * 确保记录文件存在，不存在则创建空 JSON 数组文件
 */
function ensureFile() {
  if (!fs.existsSync(RECORDS_PATH)) {
    fs.writeFileSync(RECORDS_PATH, '[]', 'utf-8');
    console.log(`[记录] 已创建记录文件: ${RECORDS_PATH}`);
  }
}

/**
 * 读取全部问答记录
 * @returns {Array<{ id: string; question: string; answer: string; demoMode: boolean; createdAt: string; error?: string }>}
 */
function readAll() {
  ensureFile();
  try {
    const raw = fs.readFileSync(RECORDS_PATH, 'utf-8');
    const list = JSON.parse(raw || '[]');
    // 按创建时间倒序
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (err) {
    console.error('[记录] 读取失败:', err.message);
    return [];
  }
}

/**
 * 追加一条问答记录
 * @param {object} record
 * @param {string} record.question 用户问题
 * @param {string} record.answer 模型回答
 * @param {boolean} record.demoMode 是否演示模式
 * @param {string} [record.error] 错误信息（可选）
 * @param {string[]} [record.sources] 检索到的参考资料摘要（可选）
 */
function append(record) {
  ensureFile();
  try {
    const list = JSON.parse(fs.readFileSync(RECORDS_PATH, 'utf-8') || '[]');
    const entry = {
      id: `qa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      question: record.question,
      answer: record.answer,
      demoMode: !!record.demoMode,
      createdAt: new Date().toISOString(),
      ...(record.error ? { error: record.error } : {}),
      ...(record.sources && record.sources.length > 0 ? { sources: record.sources } : {}),
    };
    list.push(entry);
    fs.writeFileSync(RECORDS_PATH, JSON.stringify(list, null, 2), 'utf-8');
    console.log(`[记录] 已保存问答 #${entry.id}`);
    return entry;
  } catch (err) {
    console.error('[记录] 写入失败:', err.message);
    return null;
  }
}

/**
 * 清空全部记录
 */
function clearAll() {
  fs.writeFileSync(RECORDS_PATH, '[]', 'utf-8');
  console.log('[记录] 已清空全部问答记录');
}

module.exports = {
  readAll,
  append,
  clearAll,
  getPath: () => RECORDS_PATH,
};
