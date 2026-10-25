# PromptStudio → Agent 应用 转化评估

> 评估日期：2026-10-23 ｜ 基线：`zawsstt/prompt-studio@2520b54`（已同步至工作区，构建通过）

## 1. 结论

**可以做，而且比一般项目省事。** 原因不是代码写得简单，而是它的四个原子能力，本身就是 Agent 的 tool：

| 现有能力 | 在 Agent 里的角色 |
|---|---|
| `validation.ts` + ruleset 规则引擎 | `lint_prompt` —— 确定性反馈，不花钱、不幻觉 |
| `diff.ts` + `changeBlocks` | `propose_patch` —— 结构化输出，天然可审 |
| `acceptChange / rejectChange` | Human-in-the-loop 闸门 —— Agent 不能直接落盘 |
| `createVersion / rollbackToVersion` | `commit_version` —— 每一步可回溯 |

大多数"AI 编辑器"改造 Agent 时要先发明一套变更协议；PromptStudio 已经有了，只是现在由人类点按钮触发。

**真正缺的只有三样：**
1. **服务端**（免密钥调模型 + 跨设备持久化 + 多用户）
2. **评测工具**（`run_eval`）—— 没有它，Agent 无法判断自己改得对不对，只能"感觉更好"
3. **循环与规划**（planner + 停止条件）

第 2 项正好是竞品报告里的 P0-1。**这两份方案的依赖关系是：先补评测，再做 Agent。**

---

## 2. 现状盘点

```
浏览器
├── UI      React 18 + Zustand（2212 行 store，40+ action）
├── 编辑     CodeMirror 6
├── 存储     Dexie / IndexedDB（docs, versions, chats, rulesets, workspaces, imports, keystore, localFolders）
├── 凭证     AES-GCM 加密后存本地 keystore（CryptoKey 结构化克隆）
├── 模型     fetch 直连 provider（OpenAI / Anthropic / Gemini 三套 SSE 解析）
└── 文件     File System Access API 读写本地目录
```

全部在前端，零后端。`sendChatMessage` 里已经是「system prompt + 上下文（全文/增量/Scope/脱敏）→ 流式 → 解析 changeBlocks」的单轮链路。

**这意味着：改造不需要重写，只需要在链路两端加东西——入口加服务端，出口加循环。**

---

## 3. 三个档位，看清代价

### L1 · 静态应用（今天就能做）

- 内容：`npm run build` → 部署 `dist/`
- 现状：构建已通过（1913 modules，1.28 MB / gzip 414 KB），`.github/workflows/deploy.yml` 已存在，GitHub Pages 推送即发布
- 性质：**是「应用」，不是「Agent 应用」**。用户仍需自备 API Key，数据仅在本机浏览器
- 适用：对外演示、参赛提交、给同事试用

### L2 · 免密钥 + 云端持久化（改造量：中）

- 接 WorkBuddy 云服务：LLM（免密钥）+ 数据库（docs/versions/evals）+ 认证（邮箱/手机号/微信）
- 用户在设置页里**不再需要填 API Key**，首次打开即可用
- 文档、版本、评测记录跨设备同步；可分享只读链接
- 性质：**「云化应用」**，仍不是 Agent——AI 还是一次一问
- 代价：需要处理用量配额、滥用防护；BYOK 的高级用户要保留"自带 Key"通道

### L3 · 真 Agent（改造量：大，但路径清晰）

新增一个 Agent Runtime，把"点一下改一次"变成"给个目标，自己迭代到收敛"。

```
┌─────────────────────────────── 浏览器（保留现有 UI） ───────────────────────────────┐
│  Editor / Diff / ModLog / Version Timeline                                          │
│  ▲ 只消费 changeBlocks（pending），永不直接改文稿                                    │
│  │                                                                                  │
│  └── SSE：step / tool_call / observation / patch / done                             │
└──────────────────────────────────┬──────────────────────────────────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Agent Runtime (Node)    │
                    │  ┌────────────────────────┐  │
                    │  │ Planner（LLM 决策）     │  │
                    │  └───────────┬────────────┘  │
                    │  ┌───────────▼────────────┐  │
                    │  │ Tool Executor（白名单） │  │
                    │  └───────────┬────────────┘  │
                    └──────────────┼──────────────┘
        ┌──────────────┬───────────┼────────────┬──────────────┐
        ▼              ▼           ▼            ▼              ▼
   read_doc      lint_prompt   run_eval   propose_patch   commit_version
   (读文稿)      (规则引擎)    (用例+断言)  (产出changeBlock) (写版本树)
                                   │
                    ┌──────────────▼──────────────┐
                    │ 云服务：LLM / DB / Storage   │
                    └─────────────────────────────┘
```

**Agent loop（伪代码，就是这个形状）**

```ts
const goal = {
  docId,
  target: { lint: 0, evalScore: 0.85 },
  budget: { maxSteps: 8, maxTokens: 60_000 },
}

let state = { doc, issues: lint(doc), score: await runEval(doc) }

for (let step = 0; step < goal.budget.maxSteps; step++) {
  const action = await planner.next({ goal, state, history })

  switch (action.tool) {
    case 'run_eval':      state.score  = await runEval(action.vars); break
    case 'lint_prompt':   state.issues = lint(state.doc); break
    case 'propose_patch': state.pending.push(...makeBlocks(action.diff)); break
    case 'commit_version':/* 仅当用户点击接受后由前端触发，Runtime 无此权限 */ break
  }

  if (state.score.total >= goal.target.evalScore && state.issues.length === 0) break
}

// 结束时产出：一组 pending changeBlocks + 一份推理轨迹（每步为什么这么做）
```

**三条设计红线**

| 红线 | 理由 |
|---|---|
| Agent **不能**直接写文稿，只能产出 pending blocks | 保留现有的"逐块接受"，这是产品信任的根基；也是与 prompt-optimizer 一键覆盖的根本区别 |
| 循环**必须**有硬预算（步数 / token / 成本） | 否则一次"优化"可能烧掉几块钱且不收敛 |
| 每一步**必须**可观测（工具名、入参、结果、耗时） | 用户要能看懂"它为什么改了这句"，否则等于黑箱 |

---

## 4. 改造清单（按依赖顺序）

| # | 模块 | 具体改动 | 规模 |
|---|---|---|---|
| 1 | `src/lib/eval/*` | 断言 + runner（竞品报告 P0-1）——**L3 的前置依赖** | M |
| 2 | `src/lib/variables.ts` | `{{var}}` 抽取 + 渲染 + 交叉组合 | S |
| 3 | `server/agent/` | Planner、Tool Executor、SSE 通道、预算控制 | L |
| 4 | `server/tools/*` | 五个 tool 的服务端实现（复用前端 `.ts` 逻辑，抽成同构模块） | M |
| 5 | `src/lib/api/agentClient.ts` | 前端接入 SSE、渲染 Agent 轨迹面板 | S |
| 6 | `src/store/db.ts` | v3：`evalRuns`、`agentRuns`、`callLogs` | S |
| 7 | `src/components/Agent/` | 任务面板：目标设定、运行轨迹、中断、diff 汇总 | M |
| 8 | 云服务接入 | LLM 免密钥、DB、Auth（L2 阶段） | M |

**关键工程决策：把 `validation.ts` / `diff.ts` / `parseDocumentModules` 抽成不依赖 DOM 的纯函数模块**，前端和服务端共用同一份实现。否则会出现"前端校验通过、Agent 判失败"的双标问题。

---

## 5. 风险与取舍

| 风险 | 说明 | 应对 |
|---|---|---|
| **脱敏能力会失效** | `sanitize.ts` 的会话级掩码依赖浏览器内存；服务端 Agent 看到的是明文 | 掩码表放在服务端会话内，Agent 输出后再反向替换；不要落到日志 |
| **本地文件夹写回无法上云** | File System Access API 只在浏览器可用 | 保留为本地模式；云端模式改用导入/导出 |
| **BYOK → 免密钥的成本转移** | 平台承担 token 成本 | 免费额度 + 高级用户 BYOK + 预算上限三件套 |
| **延迟** | Agent 多轮循环比单轮慢一个量级 | 流式展示每一步；允许"先出 1 块"就渲染，不等全部跑完 |
| **信任** | 用户可能不接受 AI 自主迭代 8 轮 | 默认 3 步；把"允许它自己跑几轮"做成显式设置 |

---

## 6. 建议路径

1. **本周**：L1 发布（dist 已就绪）+ 补 P0-1 评测引擎。没有评测的 Agent 是空转。
2. **下一步**：P0-2/3/4（变量、对比、策略库）——这三项即使不做 Agent 也直接提升产品完整度。
3. **再做 L2**：接云服务，去掉 API Key 门槛，拿到真实用户使用数据。
4. **最后 L3**：此时评测工具、数据结构、用户对 diff 流程的认知都已就位，Agent 只是把"人点按钮"换成"模型点按钮"。

> **一句话**：PromptStudio 不需要"变成 Agent 应用"，它需要**把已有的审计流程交给一个会自己迭代的执行者**。改造的重点不在 UI，而在"给 Agent 一副能判断对错的尺子"。
