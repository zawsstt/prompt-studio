# PromptStudio 竞品功能吸收报告

> 调研日期：2026-10-23 ｜ 星数来自 GitHub API 当日快照 ｜ 代码基线：`zawsstt/prompt-studio@2520b54`

## 1. 结论先行

高 star 的提示词项目其实分成四类，不是同一赛道：

| 类别 | 代表 | 它们解决的问题 |
|---|---|---|
| **优化器** | prompt-optimizer (39.0k) | 输入一段烂 prompt，输出一段好 prompt |
| **评测器** | promptfoo (26.3k)、opik (22.8k)、openai/evals (19.6k) | 用数据集 + 断言证明"新 prompt 真的更好" |
| **注册中心 + 可观测** | langfuse (36.2k)、phoenix (12.0k) | 线上 prompt 的版本、灰度、trace、成本 |
| **编排平台** | dify (159k)、Flowise (55.5k)、ChainForge (3.0k) | 把 prompt 变成可组合的流程图 |

PromptStudio 现在的位置很特殊：**它是唯一把「块级 Diff → 逐块接受 → 版本树回滚」做成主流程的**。上面四类项目几乎都是「生成一版新的，覆盖旧的」——没有审计粒度，也没有人审确认点。

但它缺了一整条腿：**验证闭环**。有编辑器、有校验规则、有版本，却没有「跑一批用例、用断言打分、和上一版比」的能力。这导致一个尴尬：AI 改完，你只能靠肉眼判断好不好。

所以结论不是"再堆功能"，而是：**把评测/变量/对比补上（这是护城河的支撑），把注册中心和 MCP 做成出口（这是价值的放大器），编排平台那条路不要碰。**

---

## 2. 竞品速览

| 项目 | Stars | 定位 | 最值得抄的一件事 |
|---|---:|---|---|
| [prompt-optimizer](https://github.com/linshenkx/prompt-optimizer) | 38,967 | 中文社区最火的提示词优化器，Web/桌面/Chrome 扩展/Docker 四形态 | **优化不是一个按钮，是一组策略**：系统提示词 vs 用户提示词双模式 + 分析/单评/对比评三级评估 + 评估驱动的智能重写 |
| [dspy](https://github.com/stanfordnlp/dspy) | 38,738 | "编程而非提示"的框架 | **把指标当目标函数**：签名 + metric + optimizer，自动搜出比人工更好的指令 |
| [langfuse](https://github.com/langfuse/langfuse) | 36,204 | 开源 LLM 工程平台（已被 ClickHouse 收购） | **Prompt Registry**：版本 + label（production/staging）+ 运行时拉取，改 prompt 不用发版 |
| [promptfoo](https://github.com/promptfoo/promptfoo) | 26,309 | 评测 + 红队 CLI（已加入 OpenAI） | **声明式断言矩阵**：一份 YAML 描述 prompts × providers × tests × asserts，`promptfoo view` 出矩阵，CI 里当门禁 |
| [opik](https://github.com/comet-ml/opik) | 22,841 | 评测 + 可观测 + Prompt Library | **在线评估**：线上真实流量抽样回流成数据集，形成数据飞轮 |
| [LangGPT](https://github.com/langgptai/LangGPT) | 12,624 | 结构化提示词方法论 | **Role/Profile/Workflow/Initialization 四段式**——正好可以变成 ruleset 的内置模板 |
| [promptflow](https://github.com/microsoft/promptflow) | 11,256 | 微软的 LLM 应用流水线 | 可视化 DAG + 批量评测 + 部署（与 PromptStudio 定位冲突，只借鉴评测层） |
| [ChainForge](https://github.com/ianarawjo/ChainForge) | 3,038 | 哈佛 HCI 的可视化提示词实验台 | **组合爆炸式对比**：变量做笛卡尔积，一次跑完所有排列，出箱线图 |
| [Agenta](https://github.com/Agenta-AI/agenta) | 4,852 | 已转型为"用聊天构建 AI 同事" | 转型本身是信号：纯 prompt 编辑器难以独立商业化，出口在 agent |

> 星数高但不构成竞品的：`Prompt-Engineering-Guide` (79.4k)、`awesome-chatgpt-prompts-zh` (63.9k) 是内容库；`guidance` (21.8k)、`baml` (9.4k) 是约束解码语言；`litellm` (61.8k) 是模型网关。

---

## 3. 功能矩阵

图例：✅ 完整 ｜ ⚠️ 部分/弱 ｜ ❌ 无

| 能力维度 | PromptStudio | prompt-optimizer | promptfoo | langfuse | ChainForge | opik | dify |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| 结构化编辑 + 规则校验 | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ⚠️ | ⚠️ |
| **块级 Diff + 逐块人审** | ✅ **独有** | ❌ | ❌ | ❌ | ❌ | ⚠️ | ❌ |
| 修改理由（Why/How/Effect） | ✅ **独有** | ⚠️ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 一键/多轮优化 | ⚠️ | ✅ | ❌ | ❌ | ⚠️ | ⚠️ | ⚠️ |
| 优化策略库 | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 模板变量 + 批量渲染 | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 多模型并排对比 | ❌ | ⚠️ | ✅ | ⚠️ | ✅ | ✅ | ⚠️ |
| 自动评测 / 断言 | ❌ | ✅ | ✅ | ✅ | ⚠️ | ✅ | ⚠️ |
| 数据集 / 回归基线 | ❌ | ⚠️ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| 红队 / 安全扫描 | ❌ | ❌ | ✅ | ❌ | ⚠️ | ⚠️ | ❌ |
| 版本管理 | ✅ | ⚠️ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| Prompt Registry（运行时拉取） | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ⚠️ |
| 可观测 / 成本归因 | ⚠️ | ⚠️ | ⚠️ | ✅ | ❌ | ✅ | ✅ |
| MCP / 外部集成 | ❌ | ✅ | ❌ | ❌ | ❌ | ⚠️ | ⚠️ |
| 协作 / 多用户 | ❌ | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |

**读法**：PromptStudio 在「编辑 + 审计」两列领先，在「验证 + 分发」整段空白。补的优先级应该按这个空白来排，而不是按竞品热度排。

---

## 4. 融合方案

### P0 —— 补验证闭环（不做这些，其他都是装饰）

#### P0-1 评测与断言引擎（吸收 promptfoo）

最小可用形态：一个用例集（`vars` 的数组）+ 一组断言，跑完出矩阵。

```yaml
# promptstudio.eval.yaml
prompt: ./docs/system.prompt.md
cases:
  - vars: { topic: "退款政策", lang: "zh" }
    assert:
      - type: contains
        value: "7 个工作日"
      - type: not-contains
        value: "大概"
      - type: json-schema
        value: ./schema/refund.json
      - type: llm-rubric
        value: "回答必须先给结论，再给依据，不得使用模糊限定词"
        threshold: 0.8
```

落地改造点：

| 位置 | 改动 |
|---|---|
| `src/types/index.ts` | 新增 `EvalCase` / `Assertion` / `EvalRun` / `CaseResult` |
| `src/lib/eval/assertions.ts` | 复用 `validation.ts` 的规则风格，新增 `contains / regex / json-schema / llm-rubric / latency / cost` 六类 |
| `src/lib/eval/runner.ts` | 并发跑 `adapter.sendMessage`，限制并发（默认 3），记录 token/耗时/成本 |
| `src/store/db.ts` | Dexie v3 新增 `evalRuns` 表（带 `versionId` 外键，为 P1-2 铺路） |
| `src/store/useStore.ts` | 新增 `activeView: 'eval'` 与 `runEval / cancelEval / loadEvalRuns` |
| 新组件 | `EvalView`（左：用例集；中：断言编辑；右：结果矩阵，单元格可点开看原始输出） |

**为什么这是第一优先**：它是唯一能把"AI 改得更好"从主观判断变成可复现证据的东西，也是后面 Agent 化必需的 tool。

#### P0-2 模板变量 + 交叉组合（吸收 ChainForge）

- `src/lib/variables.ts`：从正文抽取 `{{var}}`，支持默认值、必填校验、类型（string/number/enum）。
- 变量面板 + 批量值（从 CSV / JSON 粘贴导入）。
- 勾选「全组合」= 笛卡尔积，直接喂给 P0-1 的 runner。
- 与现有 Workspace Scope 打通：某变量绑到某个 module，改 module 即改所有用例。

#### P0-3 多模型并排对比（吸收 prompt-optimizer + ChainForge）

现有 `adapter.ts` 已经支持 OpenAI / Anthropic / Gemini 三套协议，加一个 `Promise.allSettled` 包装即可。UI 做 N 列并排，每列显示输出、耗时、token、成本，底部一行"结构差异摘要"（复用现有 `diff.ts`）。

成本极低、感知极强——用户第一次能直观看到"同一个 prompt 换模型差多少"。

#### P0-4 优化策略库（吸收 prompt-optimizer 的双模式 + dspy 的指标思想）

现在"让 AI 改"是一句话扔给模型，随机性大。改成**显式策略**：

| 策略 | 做什么 | 预期 diff 形态 |
|---|---|---|
| 结构补全 | 按 LangGPT 四段式（Role/Profile/Workflow/Init）补齐缺失段落 | 新增段落，不改原文 |
| 约束强化 | 把"尽量/可以"改成可判定的硬约束 | 词句级替换 |
| Few-shot 增强 | 生成 2-3 个覆盖边界情况的示例 | 追加 Example 段 |
| 去歧义 | 找指代不明、双重否定、模糊限定词 | 局部替换 |
| 压缩 | 在保持语义前提下去冗余，token 降 30%+ | 删减，块级 removed |

每个策略 = 一段 system prompt + 一组约束 + 期望 diff 粒度。**复用现有 changeBlocks 流程**，不改架构。这是 PromptStudio 相对 prompt-optimizer 的差异化：它给结果，我们给"结果 + 为什么 + 可以只接受其中一块"。

---

### P1 —— 建护城河

#### P1-1 Prompt Registry + 运行时拉取（吸收 langfuse）

给版本打 label：`production` / `staging` / `experiment-42`，生成只读产物：

```
registry.json
{
  "refund-agent": {
    "production": { "version": 8, "content": "...", "hash": "sha256:..." },
    "staging":    { "version": 9, "content": "..." }
  }
}
```

调用侧 SDK（20 行）：

```ts
const prompt = await getPrompt('refund-agent', { label: 'production' })
```

纯前端也能落地：`registry.json` 托管在 GitHub Pages / 对象存储，带 ETag 缓存。**这一条把 PromptStudio 从"写完就锁在本地"变成"能喂给线上应用"**——价值跃迁最大的一步。

#### P1-2 回归基线

`evalRuns` 按 `versionId` 归档，版本时间线上直接显示分数曲线。新版本跑完自动 diff 出「提升 4 例 / 退化 2 例」，退化例可直接跳到对应 `ChangeBlock` ——把"分数掉了"和"哪一处改动导致的"连起来。这是 promptfoo 和 langfuse 都没有做的连接点，也是 PromptStudio 结构上的天然优势。

#### P1-3 红队扫描（吸收 promptfoo red team）

内置攻击模板集：越狱、指令注入、系统提示词泄露、PII 外泄、超范围承诺。跑完出风险报告，和现有「敏感词脱敏」形成一进一出两道防线（脱敏防输入泄露，红队防输出失守）。

#### P1-4 本地调用 trace 与成本面板

每次模型调用落一条 `callLogs`：`versionId / model / tokens / latency / cost / 触发来源`。聚合出"这个 prompt 一共烧了多少钱、哪个版本最贵"。opik/langfuse 是云端方案，PromptStudio 做本地版反而更符合它的隐私定位。

---

### P2 —— 做出口

| 项 | 内容 | 价值 |
|---|---|---|
| **P2-1 MCP Server** | 把 docs / versions / rulesets 暴露为 MCP resources，加一个 `optimize_prompt` tool | 让 Claude Desktop / Cursor 直接读写团队 prompt 库。与你在做的 Eisland / Cordis MCP 生态是同一条线 |
| **P2-2 CI 门禁** | `promptstudio eval --config` CLI（Node，复用 `lib/eval`），GitHub Action 里低于阈值阻断合并 | 把评测从"偶尔跑一次"变成"每次改动都跑" |
| **P2-3 浏览器扩展** | 在 ChatGPT / Claude 页面里一键把当前对话送进 PromptStudio | prompt-optimizer 的主要流量入口就是 Chrome 扩展，验证过有效 |

---

## 5. 不建议吸收

| 不抄 | 原因 |
|---|---|
| DAG / 节点式编排（Dify、Flowise、ChainForge 的 flow 画布） | 与"文档编辑器"的产品心智直接冲突，实现成本是现有代码量的数倍，且会被 Dify 正面碾压 |
| 完整 LLMOps（trace 存储、标注队列、多人权限） | 会变成 Langfuse 的劣化版。这些应该通过 P1-1 的出口"交给"专业工具，而不是自己做 |
| 自建模型网关 / 计费 | LiteLLM 已经做到 61.8k star，自研没有意义 |
| 提示词市场 / 内容库 | 内容有版权风险，且不构成产品壁垒 |

---

## 6. License 提示

| 项目 | License | 可用方式 |
|---|---|---|
| promptfoo | MIT | 可直接参考实现、可移植断言 DSL 设计 |
| ChainForge | MIT | 可参考交叉组合与评估节点设计 |
| langfuse | MIT | 可参考 registry 的 label/缓存策略 |
| **prompt-optimizer** | **AGPL-3.0** | **只借鉴交互与产品思路，不复制代码**（AGPL 具有传染性，商用需谨慎） |
| LangGPT | 开源 | 四段式方法论可自由使用，不要整段抄模板文案 |

---

## 7. 一句话路线

> **P0 补上「跑得起来、验得了」**（评测 + 变量 + 对比 + 策略库）→ **P1 补上「证明得了、管得住」**（Registry + 基线 + 红队）→ **P2 补上「接得出去」**（MCP + CI）。
>
> 编排平台那条路不走。PromptStudio 的差异化始终是：**别人给你一个新版本，我们给你一个可以逐块审阅、逐块接受的改动。**
