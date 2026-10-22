/* ============================================================
   PROMPTSTUDIO — Chat Module
   Message sending, streaming simulation, context bar, reasoning
   ============================================================ */

import State from './store.js';
import Events from './events.js';
import { escapeHtml, $, $$ } from './utils.js';
import { MODEL_LIST } from './data.js';

const dom = {};

export function initChat() {
  dom.messages = $('#chat-messages');
  dom.input = $('#chat-input');
  dom.contextBar = $('#context-bar');
  dom.sendBtn = $('#btn-send');
  dom.reasoningToggle = $('#reasoning-toggle');

  if (!dom.messages || !dom.input) return;

  // Send button
  if (dom.sendBtn) {
    dom.sendBtn.addEventListener('click', sendMessage);
  }

  // Enter to send, Shift+Enter for newline
  dom.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize input
  dom.input.addEventListener('input', () => {
    dom.input.style.height = 'auto';
    dom.input.style.height = Math.min(dom.input.scrollHeight, 120) + 'px';
  });

  // @-mention
  dom.input.addEventListener('input', handleAtMention);

  // Reasoning toggle
  if (dom.reasoningToggle) {
    dom.reasoningToggle.addEventListener('click', toggleReasoning);
    updateReasoningToggleUI();
  }

  // Subscribe to model changes
  State.subscribe('chat.selectedModel', () => {
    // Update UI if needed
  });

  // Restore messages from state
  const messages = State.get('chat.messages') || [];
  if (messages.length === 0) {
    showEmptyState();
  }
}

function sendMessage() {
  const text = dom.input.value.trim();
  if (!text || State.get('chat.isStreaming')) return;

  // Clear input
  dom.input.value = '';
  dom.input.style.height = 'auto';

  // Hide empty state
  hideEmptyState();

  // Add user message
  addUserMessage(text);

  // Simulate AI response with streaming
  State.set('chat.isStreaming', true);
  const aiMsgEl = addAIMessage('', true);

  // Generate mock AI response (includes full doc + JSON explanations)
  const aiRawResponse = generateRawAIResponse(text);

  const hasReasoning = State.get('ui.showReasoning') && Math.random() > 0.4;
  const reasoning = hasReasoning
    ? '分析当前 prompt 结构…\n\n1. 检测到 Instructions 章节语气偏陈述式，建议改为强祈使句以提高指令遵循率\n2. 缺少输出校验步骤，可能导致 JSON 格式异常\n3. 示例数量偏少，建议扩充以覆盖更多场景\n4. 模块顺序基本符合 Anthropic Skill 标准（frontmatter → instructions → examples → references）'
    : null;

  streamResponse(aiMsgEl, aiRawResponse, reasoning);
}

function addUserMessage(text) {
  const el = document.createElement('div');
  el.className = 'msg user anim-fade-in-up';
  el.innerHTML = `<div class="msg-bubble">${escapeHtml(text)}</div>`;
  dom.messages.appendChild(el);
  scrollToBottom();

  const messages = State.get('chat.messages') || [];
  messages.push({ role: 'user', content: text, timestamp: Date.now() });
  State.set('chat.messages', messages);
}

function addAIMessage(content = '', streaming = false) {
  const el = document.createElement('div');
  el.className = `msg ai${streaming ? ' streaming' : ' anim-fade-in-up'}`;
  el.innerHTML = `
    <div class="msg-bubble">
      <div class="reasoning-placeholder"></div>
      <div class="ai-content">${escapeHtml(content)}${streaming ? '<span class="typing-cursor"></span>' : ''}</div>
      <div class="msg-actions" style="display:none">
        <button class="btn btn-primary btn-sm apply-btn">应用为候选修改</button>
        <button class="btn btn-ghost btn-sm copy-btn">复制</button>
      </div>
      <div class="msg-meta" style="display:none"></div>
    </div>
  `;
  dom.messages.appendChild(el);
  scrollToBottom();

  // Store reference for streaming
  el._aiData = { content: '', reasoning: null };
  return el;
}

function streamResponse(el, fullText, reasoning = null) {
  const contentDiv = el.querySelector('.ai-content');
  const reasoningPlaceholder = el.querySelector('.reasoning-placeholder');
  let i = 0;

  // Render reasoning block if present
  if (reasoning) {
    el._aiData.reasoning = reasoning;
    const reasoningBlock = document.createElement('div');
    reasoningBlock.className = 'reasoning-block open';
    reasoningBlock.innerHTML = `
      <div class="reasoning-header" onclick="this.parentElement.classList.toggle('open')">
        <svg class="reasoning-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
        <span>Reasoning</span>
      </div>
      <div class="reasoning-body">
        <div class="reasoning-content">${escapeHtml(reasoning)}</div>
      </div>
    `;
    reasoningPlaceholder.replaceWith(reasoningBlock);
  }

  // Stream text
  const interval = setInterval(() => {
    i += Math.floor(Math.random() * 5) + 2;
    if (i >= fullText.length) {
      contentDiv.textContent = fullText;
      el.classList.remove('streaming');
      clearInterval(interval);
      State.set('chat.isStreaming', false);
      finishAIMessage(el, fullText, reasoning);
      return;
    }
    contentDiv.innerHTML = escapeHtml(fullText.slice(0, i)) + '<span class="typing-cursor"></span>';
    scrollToBottom();
  }, 20);
}

function finishAIMessage(el, content, reasoning) {
  // Show actions
  const actions = el.querySelector('.msg-actions');
  if (actions) {
    actions.style.display = 'flex';
    actions.querySelector('.apply-btn').addEventListener('click', () => applyAsCandidate());
    actions.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        Events.emit('toast', '已复制到剪贴板');
      });
    });
  }

  // Show meta
  const meta = el.querySelector('.msg-meta');
  if (meta) {
    const modelId = State.get('chat.selectedModel') || 'deepseek-chat';
    const model = MODEL_LIST.find(m => m.id === modelId);
    meta.style.display = 'flex';
    meta.innerHTML = `
      <span>🤖 ${model?.name || modelId}</span>
      <span>📊 ~${Math.round(content.length / 2.5)} tokens</span>
      <span>💰 ¥${(content.length / 1500).toFixed(3)}</span>
    `;
  }

  // Save to state
  const messages = State.get('chat.messages') || [];
  messages.push({
    role: 'ai',
    content,
    reasoning,
    modelId: State.get('chat.selectedModel'),
    timestamp: Date.now(),
  });
  State.set('chat.messages', messages);

  Events.emit('chat:message-received', { content, reasoning });
}

function applyAsCandidate() {
  const original = State.get('doc.content');
  const messages = State.get('chat.messages');

  // Generate clean modified document by applying changes directly to original.
  // This guarantees the candidate is a valid, complete prompt — no AI commentary
  // or extraneous text ever leaks into the diff comparison.
  const modifiedContent = generateModifiedContent(original);

  // Parse Why/How/Effect from AI response's JSON explanations block
  const lastAI = [...messages].reverse().find(m => m.role === 'ai');
  const explanations = lastAI ? parseExplanationsFromResponse(lastAI.content) : [];
  const changeBlocks = explanations.length > 0 ? explanations : generateChangeBlocks();

  State.set('doc.candidateContent', modifiedContent);
  State.set('diff.changeBlocks', changeBlocks);
  State.set('diff.currentChangeIdx', -1);

  Events.emit('toast', '✅ 已应用为候选修改，正在对比…');
  Events.emit('diff:open');
}

/**
 * Generate mock AI raw response that simulates a real API response.
 * Includes:
 *   - Commentary/analysis (shown in chat)
 *   - Complete modified document wrapped in ```markdown code fence
 *   - JSON explanations block for Why/How/Effect metadata
 */
function generateRawAIResponse(userMsg) {
  const modifiedDoc = generateModifiedContent(State.get('doc.content'));

  // Build JSON explanations that align with the change blocks
  const explanations = JSON.stringify({
    blocks: [
      {
        id: 'cb1',
        type: 'replace',
        oldSnippet: '你是一个任务协调 agent。你的核心职责是…',
        newSnippet: '你是任务协调 agent。核心职责：…',
        why: '祈使句语气更直接，减少"你"字冗余，模型遵循率更高。关联规则：style/person-consistency',
        how: '将 Instructions 章节中的描述性语句改为强祈使句，去掉冗余代词，精简指令结构。',
        effect: '指令确定性增强，输出格式更稳定，预计歧义率降低 20%+。',
      },
      {
        id: 'cb2',
        type: 'add',
        oldSnippet: '(不存在)',
        newSnippet: '5. **校验输出**：检查 JSON 格式合规性与数据完整性',
        why: '当前版本缺少输出校验步骤，模型可能输出不符合规范的 JSON。关联规则：structure/require-validation-step',
        how: '在 Instructions 步骤列表末尾新增第 5 步校验步骤。',
        effect: 'JSON 输出格式合规率预计提升 30%+，减少下游解析错误。',
      },
      {
        id: 'cb3',
        type: 'add',
        oldSnippet: '(不存在)',
        newSnippet: '### 示例 2：多维度对比…',
        why: '覆盖更多使用场景，提升模型在复杂查询下的表现。',
        how: '丰富示例场景，展示三个实体 + 多个指标的并行查询流程。',
        effect: '丰富模型 Few-shot 学习样本，复杂查询准确率预计提升。',
      },
    ],
  }, null, 2);

  return `好的，我已经根据你的需求分析了当前 prompt，并提出以下修改建议：

**修改摘要：**

1. **指令语气优化（替换）**：将 Instructions 章节中的描述性语句改为强祈使句，增强指令确定性。
2. **补充输出格式校验步骤（新增）**：在处理步骤中新增第 5 步"校验输出"，确保 JSON 格式合规性与数据完整性。
3. **丰富示例（新增）**：新增"多指标对比"示例，覆盖更多使用场景。

以下是完整的修改后文档：

\`\`\`markdown
${modifiedDoc}
\`\`\`

\`\`\`json-explanations
${explanations}
\`\`\``;
}

function generateModifiedContent(original) {
  // Simulated modification for demo purposes
  return original
    .replace(
      '你是一个任务协调 agent。你的核心职责是接收用户的查询请求，将其分解为子任务，并协调各子 agent 完成任务执行。',
      '你是任务协调 agent。核心职责：接收用户查询请求，分解为子任务，协调各子 agent 完成任务执行。'
    )
    .replace('当用户提出请求时，请按以下步骤处理：', '**处理步骤（严格按顺序执行）**：')
    .replace(
      '4. **汇总结果**：合并各子 agent 返回的数据，生成统一视图',
      '4. **汇总结果**：合并各子 agent 返回的数据，生成统一视图\n5. **校验输出**：检查 JSON 格式合规性与数据完整性'
    )
    .replace('请始终以 JSON 格式输出分析结果，包含以下字段：', '**必须以 JSON 格式输出**，不得包含额外说明文字。JSON Schema 如下：')
    .replace('"results": "汇总结果"\n}', '"results": "汇总结果（结构化对象）",\n  "confidence": 0.0\n}')
    .replace(
      '用户输入："帮我分析过去一个季度的数据趋势"\n→ 解析时间范围和数据类型 → 并行查询 → 汇总对比',
      '### 示例 1：趋势分析\n用户输入："帮我分析过去一个季度的数据趋势"\n→ 解析时间范围和数据类型\n→ 并行查询 → 汇总对比输出\n\n### 示例 2：多维度对比\n用户输入："对比产品A、B、C的核心指标"\n→ 解析三个产品、多个指标\n→ 并行查询各产品数据 → 交叉对比 → 表格输出'
    )
    .replace(
      '- 子 Agent 通信协议参见 SKILL.md 各子 agent 目录',
      '- 子 Agent 通信协议参见 SKILL.md 各子 agent 目录\n- 数据校验规则参见 references/validation-rules.md'
    );
}

function generateChangeBlocks() {
  return [
    {
      id: 'cb1', type: 'replace',
      oldRange: 'L10-L12', newRange: 'L10-L14',
      oldSnippet: '你是一个任务协调 agent。你的核心职责是…',
      newSnippet: '你是任务协调 agent。核心职责：…',
      why: '祈使句语气更直接，减少"你"字冗余，模型遵循率更高。关联规则：style/person-consistency',
      how: '将 Instructions 章节中的描述性语句改为强祈使句，去掉冗余代词，精简指令结构。',
      effect: '指令确定性增强，输出格式更稳定，预计歧义率降低 20%+。',
      model: 'DeepSeek Chat', tokens: '2.4k', cost: '¥0.004', version: 'v3→v4', accepted: null,
    },
    {
      id: 'cb2', type: 'add',
      oldRange: '—', newRange: 'L16-L17',
      oldSnippet: '(不存在)',
      newSnippet: '5. **校验输出**：检查 JSON 格式合规性与数据完整性',
      why: '当前版本缺少输出校验步骤，模型可能输出不符合规范的 JSON。',
      how: '在 Instructions 步骤列表末尾新增第 5 步校验步骤。',
      effect: 'JSON 输出格式合规率预计提升 30%+，减少下游解析错误。',
      model: 'DeepSeek Chat', tokens: '0.8k', cost: '¥0.001', version: 'v3→v4', accepted: null,
    },
    {
      id: 'cb3', type: 'add',
      oldRange: '—', newRange: 'L25-L28',
      oldSnippet: '(不存在)',
      newSnippet: '### 示例 2：多指标对比…',
      why: '覆盖更多使用场景，提升模型在复杂查询下的表现。',
      how: '丰富示例场景，展示三个实体 + 多个指标的并行查询流程。',
      effect: '丰富模型 Few-shot 学习样本，复杂查询准确率预计提升。',
      model: 'DeepSeek Chat', tokens: '1.0k', cost: '¥0.002', version: 'v3→v4', accepted: null,
    },
  ];
}

// ───────────────────────────────────────────────
// AI Response Parsers (document extraction + explanations)
// ───────────────────────────────────────────────

/**
 * Extract a clean, complete modified document from an AI response.
 *
 * Strategies (tried in order):
 *   A) Extract from ```markdown / ```yaml code fence — most reliable
 *   B) Locate by YAML frontmatter pattern (---\nname:...)
 *   C) Locate by markdown heading (# ...)
 *   D) Strip common AI commentary prefixes, retry B/C
 *
 * @param {string} raw   - The full AI response text
 * @param {string} original - The original document (for fallback validation)
 * @returns {string|null} Clean complete document, or null if extraction fails
 */
function extractDocumentFromAIResponse(raw, original) {
  if (!raw) return null;

  // ── Strategy A: Line-by-line fence parser (handles nested ``` blocks) ──
  // Documents like SKILL.md often contain their own ```json ... ``` blocks.
  // A naive regex with ([\s\S]*?)``` would stop at the FIRST ``` — wrong.
  // This parser tracks fence depth: only untagged ``` closes the outer fence.
  const docFromFence = extractFromCodeFence(raw);
  if (docFromFence) return docFromFence;

  // ── Helper: strip JSON explanations block ──
  const stripExplanations = (text) => text.replace(/```json-explanations[\s\S]*?```/g, '').trim();

  // ── Helper: trim trailing commentary ──
  const trimCommentary = (text) => {
    return text
      .replace(/\n{2,}(?:以上是|修改完成|修改完毕|---\s*\n?\s*$)[\s\S]*$/g, '')
      .replace(/\n{2,}(?:That(?:'s| is)|Here(?:'s| is)|I hope)[\s\S]*$/gi, '')
      .trim();
  };

  // ── Strategy B: Locate document by YAML frontmatter ──
  const fmRegex = /^---\s*\n(?:name|title|description):\s*\S/m;
  const fmMatch = raw.match(fmRegex);
  if (fmMatch) {
    let extracted = raw.slice(fmMatch.index);
    extracted = stripExplanations(extracted);
    extracted = trimCommentary(extracted);
    if (extracted.split('\n').length >= 3) {
      return extracted;
    }
  }

  // ── Strategy C: Locate by markdown heading ──
  const headingRegex = /^#\s/m;
  const hMatch = raw.match(headingRegex);
  if (hMatch) {
    let extracted = raw.slice(hMatch.index);
    extracted = stripExplanations(extracted);
    extracted = trimCommentary(extracted);
    if (extracted.split('\n').length >= 5) {
      return extracted;
    }
  }

  // ── Strategy D: Strip common AI commentary, then retry B/C ──
  const commentaryStrippers = [
    /^(?:好的[，,、]?|ok[，,、]?|收到[，,、]?|明白了[，,、]?|了解[，,、]?|没问题[，,、]?)\s*(?:以下|这|我|根据|按照|针对|关于|请|已|现在)[\s\S]*?(?=\n\n|---\n|```|^#\s)/im,
    /^(?:Sure!?|Here(?:'s| is)|Below is|I(?:'ve| have)|Let me)[\s\S]*?(?=\n\n|---\n|```|^#\s)/im,
  ];

  let cleaned = raw;
  for (const pattern of commentaryStrippers) {
    cleaned = cleaned.replace(pattern, '');
  }
  cleaned = cleaned.trim();

  // Retry frontmatter match on cleaned text
  if (fmRegex.test(cleaned)) {
    let result = stripExplanations(cleaned);
    result = trimCommentary(result);
    if (result.split('\n').length >= 3) return result;
  }

  // Retry heading match on cleaned text
  if (headingRegex.test(cleaned)) {
    let result = stripExplanations(cleaned);
    result = trimCommentary(result);
    if (result.split('\n').length >= 5) return result;
  }

  // ── Last resort ──
  if (cleaned.length > 50 && cleaned !== original && cleaned.split('\n').length >= 5) {
    return cleaned;
  }

  return null;
}

/**
 * Line-by-line code-fence parser that correctly handles nested ``` blocks.
 *
 * A Markdown document like SKILL.md often contains its own ```json ... ```
 * code blocks. Regex-based extraction fails because ([\\s\\S]*?)``` would
 * stop at the first ``` it encounters inside the document.
 *
 * This parser tracks fence entrance/exit by language tag presence:
 *   - ```markdown  or ``` → OPENS outer document fence
 *   - ```json        → NOT a closer (has language tag) → treated as content
 *   - ```            → real closer (no language tag, on its own line)
 *
 * @param {string} raw - Full AI response text
 * @returns {string|null} Extracted document content, or null
 */
function extractFromCodeFence(raw) {
  const lines = raw.split('\n');
  let inDocFence = false;
  let fenceContent = [];
  let nestedDepth = 0;  // tracks ```json / ```yaml nested inside doc fence

  for (const line of lines) {
    const fenceMatch = line.match(/^```(.*)/);

    if (fenceMatch && !inDocFence) {
      // Opening a document fence
      const lang = fenceMatch[1].trim().toLowerCase();
      const isDoc = lang === 'markdown' || lang === 'md' || lang === 'yaml' || lang === 'yml' || lang === '';
      if (isDoc) {
        inDocFence = true;
        fenceContent = [];
        nestedDepth = 0;
      }
      continue;
    }

    if (fenceMatch && inDocFence) {
      const tag = fenceMatch[1].trim();
      if (tag) {
        // Tagged ``` (e.g. ```json, ```yaml) → enters a nested inner fence
        nestedDepth++;
        fenceContent.push(line);
      } else {
        // Untagged ``` — closes the innermost fence
        if (nestedDepth > 0) {
          // Closing a nested inner fence, NOT the doc fence
          nestedDepth--;
          fenceContent.push(line);
        } else {
          // Depth = 0 → this closes the outer document fence
          const block = fenceContent.join('\n').trim();
          if ((/^---\s*\n/.test(block) || /^#\s/m.test(block)) && block.split('\n').length >= 3) {
            return block;
          }
          inDocFence = false;
        }
      }
      continue;
    }

    if (inDocFence) {
      fenceContent.push(line);
    }
  }

  // Handle case where fence extends to EOF
  if (inDocFence && fenceContent.length >= 3) {
    const block = fenceContent.join('\n').trim();
    if ((/^---\s*\n/.test(block) || /^#\s/m.test(block)) && block.split('\n').length >= 3) {
      return block;
    }
  }

  return null;
}

/**
 * Parse the JSON explanations block from AI response.
 * Produces change block objects with Why/How/Effect metadata
 * that the diff view uses for hover tooltips.
 *
 * @param {string} raw - The full AI response text
 * @returns {Array} Array of change block objects
 */
function parseExplanationsFromResponse(raw) {
  const match = raw.match(/```json-explanations\s*\n([\s\S]*?)```/);
  if (!match) return [];

  try {
    const parsed = JSON.parse(match[1]);
    if (!parsed.blocks || !Array.isArray(parsed.blocks)) return [];

    return parsed.blocks.map((b, i) => ({
      id: b.id || `cb-${i}`,
      type: b.type || 'replace',
      oldRange: b.oldRange || '—',
      newRange: b.newRange || '—',
      oldSnippet: b.oldSnippet || '',
      newSnippet: b.newSnippet || '',
      why: b.why || '',
      how: b.how || '',
      effect: b.effect || '',
      model: b.model || '',
      tokens: b.tokens || '',
      cost: b.cost || '',
      version: b.version || '',
      accepted: null,
    }));
  } catch (e) {
    console.warn('parseExplanationsFromResponse: JSON parse failed', e);
    return [];
  }
}

function handleAtMention() {
  const val = dom.input.value;
  const atIdx = val.lastIndexOf('@');
  if (atIdx >= 0 && val.charAt(Math.max(0, atIdx - 1)) !== '\\') {
    const query = val.slice(atIdx + 1).toLowerCase();
    const files = ['references/fields.md', 'scripts/postprocess.py', 'SKILL.md'];
    const matches = files.filter(f => f.toLowerCase().includes(query));
    if (matches.length && query.length >= 1) {
      dom.contextBar.innerHTML = matches.map(f => `
        <span class="chip">
          <svg class="chip-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${f}
          <span class="chip-remove" onclick="this.parentElement.remove()">×</span>
        </span>
      `).join('');
    }
  } else if (!val.includes('@') && dom.contextBar.children.length > 0) {
    dom.contextBar.innerHTML = '';
  }
}

function toggleReasoning() {
  const current = State.get('ui.showReasoning');
  State.set('ui.showReasoning', !current);
  updateReasoningToggleUI();

  // Toggle visibility of all reasoning blocks
  $$('.reasoning-block').forEach(block => {
    if (!current) {
      block.classList.add('open');
    } else {
      block.classList.remove('open');
    }
  });
}

function updateReasoningToggleUI() {
  if (!dom.reasoningToggle) return;
  const show = State.get('ui.showReasoning');
  dom.reasoningToggle.classList.toggle('on', show);
  dom.reasoningToggle.innerHTML = `
    <span class="rt-dot"></span>
    Reasoning ${show ? 'ON' : 'OFF'}
  `;
}

function showEmptyState() {
  if (!dom.messages) return;
  dom.messages.innerHTML = `
    <div class="chat-empty">
      <svg class="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p>在下方输入修改需求，AI 将生成候选修改</p>
      <p style="font-size:11px;opacity:0.6">发送后点击「应用为候选修改」进入对比视图</p>
    </div>
  `;
}

function hideEmptyState() {
  const emptyEl = dom.messages?.querySelector('.chat-empty');
  if (emptyEl) emptyEl.remove();
}

function scrollToBottom() {
  if (dom.messages) {
    dom.messages.scrollTop = dom.messages.scrollHeight;
  }
}

export function clearChat() {
  if (dom.messages) {
    dom.messages.innerHTML = '';
    showEmptyState();
  }
  State.set('chat.messages', []);
}

export default { initChat, clearChat };
