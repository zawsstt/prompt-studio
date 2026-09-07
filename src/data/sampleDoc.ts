/**
 * 全新用户的首个文档模板（发版级：不预置任何业务示例数据）。
 * 仅提供结构与引导注释，避免「首次使用看到历史业务内容」的观感。
 * 有历史记录的用户不受影响（init 从 IndexedDB 恢复其文档）。
 */
export const SAMPLE_DOC = `---
name: your-agent-name
description: 一句话描述你的 Prompt / Skill 的用途
---

# Instructions

在这里编写你的 Prompt / Skill 指令。建议遵循以下结构：

1. **角色**：说明这个 Agent 扮演什么角色
2. **任务**：说明它需要完成的核心任务
3. **约束**：说明必须遵守的规则与边界
4. **输出格式**：说明期望的输出结构

## Output Format

\`\`\`json
{
  "intent": "用户意图描述",
  "result": "处理结果"
}
\`\`\`

## Examples

添加 1-2 个输入输出示例，帮助模型理解期望行为。

## References

- 相关规则集与引用文件可在「工作区」中勾选并应用到 AI 对话
`;
