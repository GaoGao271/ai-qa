/**
 * 被测模块：src/record/qaRecord.js
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { append, readAll, clearAll } from '../src/record/qaRecord'

// 每次测试前清空数据
beforeEach(() => {
  clearAll()
})

describe('qaRecord 问答记录读写服务', () => {
  it('新增一条记录，记录总数 +1', () => {
    const before = readAll().length
    append({ question: '测试问题', answer: '测试答案' })
    const after = readAll().length
    expect(after).toBe(before + 1)
  })

  it('读取记录，能拿到刚刚新增的内容', () => {
    const testItem = { question: 'Node事件循环', answer: '宏任务微任务' }
    append(testItem)
    const list = readAll()
    expect(list[0].question).toBe(testItem.question)
    expect(list[0].answer).toBe(testItem.answer)
  })

  it('记录按时间倒序（最新的排在最前面）', async () => {
    append({ question: '问题1', answer: '答案1' })
    // 等待 2ms，避免两条记录 createdAt 相同导致排序断言不稳定
    await new Promise((resolve) => setTimeout(resolve, 2))
    append({ question: '问题2', answer: '答案2' })
    const list = readAll()
    expect(list[0].question).toBe('问题2')
    expect(list[1].question).toBe('问题1')
  })
})
