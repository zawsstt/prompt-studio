# PromptStudio 品牌视觉规范（Brand & Visual Spec）

> 日期：2026-08-05 ｜ 架构师：Bob
> 现状基线：`src/styles/index.css`（暗色工作台，已有完整 token 体系）、官网落地页基因（#6366F1 靛蓝、28px 大圆角、cubic-bezier(0.16,1,0.3,1)）
> 定位：专业开发者工具 = 克制的深色工作台 + 高识别度的"Diff 四色"品牌基因。**拒绝模板化"AI 味"**（不用紫粉渐变堆砌、不用 emoji 当图标、不用泛玻璃拟态）。

---

## 1. 品牌基因（Brand DNA）

| 基因 | 内容 | 来源 |
|---|---|---|
| **品牌主色** | Indigo `#6366F1` | 官网落地页 + 现有 `--brand` |
| **Diff 四色语义** | 新增绿 / 删除红 / 替换蓝 / 重排橙 | 产品核心识别资产，**任何场景不得改义** |
| **品牌渐变** | `135deg, #6366F1 → #818CF8`（靛蓝→浅靛） | 仅用于品牌标记、主按钮高光、Logo 场景 |
| **工作台底色** | 深空蓝黑 `#0B0B12` 系 | 现有暗色主题，为专业工具定调 |
| **动效曲线** | `cubic-bezier(0.16, 1, 0.3, 1)`（easeOutExpo 系） | 官网基因，全产品统一 |

**品牌一句话**：*"看见每一处修改"* —— 视觉系统围绕"变更的可视化"建立，四色是我们的"可口可乐红"。

---

## 2. 品牌色板

### 2.1 主色与中性色（暗色主题为 Canonical）

| Token | 值 | 用途 | 对比度校验（对 --bg-darkest） |
|---|---|---|---|
| `--brand` | `#6366F1` | 主按钮、激活态、焦点环 | 图标/大面积使用（文本用 brand-light） |
| `--brand-light` | `#818CF8` | 品牌色文本、链接、图标 | ≈5.9:1 ✅ |
| `--brand-dark` | `#4F46E5` | 主按钮 hover 下压 | — |
| `--brand-gradient` | `linear-gradient(135deg,#6366F1,#818CF8)` | 品牌标记、Logo 圆点、主 CTA 高光边 | — |
| `--bg-darkest` | `#0B0B12` | 应用底 | — |
| `--bg-dark` | `#111119` | 顶栏/侧栏/面板底 | — |
| `--bg-card` | `#181820` | 卡片 | — |
| `--bg-elevated` | `#1E1E28` | 浮层/气泡 | — |
| `--bg-hover` | `#25252F` | hover 底色 | — |
| `--bg-input` | `#1A1A22` | 输入框 | — |
| `--border` | `#2A2A38` | 默认描边 | — |
| `--border-light` | `#33334A` | 强调描边 | — |
| `--text-primary` | `#E8E8F0` | 主文本 | ≈14.6:1 ✅ |
| `--text-secondary` | `#A0A0B0` | 次文本 | ≈7.5:1 ✅ |
| `--text-muted` | `#8A8A9A` ⚠️ **调整** | 辅助文本 | ≈4.6:1 ✅（原 `#6A6A7A` 仅 ≈3.9:1，不达标，统一上调） |

> 规则：所有"承载信息的文本"（含辅助文本）对背景对比度 ≥ 4.5:1；纯装饰性分隔线/图标可放宽至 3:1。

### 2.2 Diff 四色语义（产品基因，冻结不改义）

| Token | 主色 | 底色（12% 透明） | 亮色（高亮文本/字符级） | 语义 |
|---|---|---|---|---|
| `--diff-add*` | `#16A34A` | `rgba(22,163,74,.12)` | `#4ADE80` | 新增（仅用于"新增"语义） |
| `--diff-del*` | `#DC2626` | `rgba(220,38,38,.12)` | `#F87171` | 删除（永远伴随删除线） |
| `--diff-replace*` | `#2563EB` | `rgba(37,99,235,.12)` | `#60A5FA` | 替换 |
| `--diff-reorder*` | `#D97706` | `rgba(217,119,6,.12)` | `#FBBF24` | 重排（P1-1 落地后启用） |

**四色使用纪律**：
- 四色 = "变更类型"专用，不得挪作普通成功/错误/信息提示（普通语义色见 2.3）；
- 四色徽标统一形态：4px 圆角矩形底 + 亮色文本（`.mod-log-badge` 既有形态）；
- 重排橙出现处建议带 `⇄` 方向暗示（用 Lucide `ArrowRightLeft` 图标，不用 emoji）。

### 2.3 通用语义色（与 Diff 四色解耦）

| Token | 值 | 用途 |
|---|---|---|
| `--success` | `#16A34A`（与 diff-add 同值不同义） | 连接成功、操作完成 |
| `--warn` | `#EAB308` | 校验警告、待确认 |
| `--error` | `#EF4444` | 校验错误、操作失败 |
| `--info` | `#818CF8`（复用 brand-light） | 提示级校验、中性信息 |

> 校验三级别配色：error 红 / warning 黄 / info 靛——与 Diff 四色在用户心智中分属"校验"与"变更"两个频道，不冲突。

---

## 3. 字体系统

### 3.1 双字体策略

| 角色 | 字体栈 | 说明 |
|---|---|---|
| UI/正文 | `"Inter", -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif` | Inter 提供专业的数字/拉丁字形；中文回落系统黑体 |
| 代码/文档/数据 | `"JetBrains Mono", "Cascadia Code", "Fira Code", Consolas, monospace` | 编辑器、Diff、token/成本数字、版本号、文件路径 |

加载方式（`index.html` 加 `<link>`，不引入 npm 依赖）：
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```
离线场景自动回落系统字体栈，功能不受影响。

### 3.2 字阶（Type Scale，1.125 比例微调）

| Token | 大小 | 行高 | 字重 | 用途 |
|---|---|---|---|---|
| `--font-size-xs` | 11px | 1.4 | 400/500 | 徽标、统计、辅助标注 |
| `--font-size-sm` | 12px | 1.45 | 400/500 | 按钮、次文本、面板内容 |
| `--font-size-base` | 13px | 1.5 | 400 | 正文、编辑器（等宽） |
| `--font-size-md` | 14px | 1.5 | 500 | 面板标题、强调正文 |
| `--font-size-lg` | 16px | 1.4 | 600 | 弹窗标题 |
| `--font-size-xl` | 20px | 1.3 | 600 | 页面级标题（工作台内少用） |
| `--font-size-num` | 12px | 1 | 500 | 统计数字（等宽 + `font-variant-numeric: tabular-nums`） |

规则：数字计量（tokens/成本/行号/字符数）一律等宽字体 + tabular-nums，杜绝跳动。

---

## 4. 组件样式规范

### 4.1 圆角

| Token | 值 | 用途 |
|---|---|---|
| `--radius-sm` | 4px | 徽标、chip、代码内联 |
| `--radius-base` | 6px | 按钮、输入框、下拉 |
| `--radius-lg` | 8px | 卡片、面板 |
| `--radius-xl` | 12px ⚠️ 新增 | 弹窗、ModLog 面板、hover 气泡 |
| `--radius-brand` | 28px | **仅**品牌展示场景（落地页/关于页）沿用官网大圆角基因；工作台内不用 |
| `--radius-full` | 999px | 状态点、头像、toggle |

### 4.2 阴影与层级

| Token | 值 | 用途 |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,.3)` | 卡片静止 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,.4)` | 下拉、popover |
| `--shadow-lg` | `0 12px 32px rgba(0,0,0,.5)` | 弹窗、ModLog |
| `--shadow-xl` | `0 24px 64px rgba(0,0,0,.6)` | 全屏 overlay 上的 dialog |
| `--shadow-brand` ⚠️ 新增 | `0 0 0 1px rgba(99,102,241,.35), 0 4px 16px rgba(99,102,241,.15)` | 品牌相关聚焦态（主 CTA hover、激活范围卡片） |

### 4.3 按钮（`.btn` 体系，现状已合规，补强三态）

| 变体 | 静止 | hover | active/焦点 |
|---|---|---|---|
| `btn-primary` | `--brand-gradient` 底（升级：由纯色改为品牌渐变，强化记忆点）、白字 | 亮度 +8%（`filter: brightness(1.08)`），**不位移不放大** | `:focus-visible` 2px `--brand-light` 外环（offset 2px） |
| `btn-ghost` | 透明底、`--text-secondary` | `--bg-hover` 底、`--text-primary` | 同上 |
| `btn-secondary` | `--bg-elevated` 底 | `--bg-hover` | 同上 |
| `btn-success/danger` | 语义色底 | brightness(1.08) | 同上 |
| disabled | `opacity:.4; cursor:not-allowed` | 无 hover 反馈 | — |

统一：`transition: all 150ms var(--ease-out)`；**hover 禁止改变尺寸/边框宽度**（防布局位移）。

### 4.4 卡片 / 面板 / 浮层

- 卡片：`--bg-card` + `1px --border` + `--radius-lg` + `--shadow-sm`；hover（可点卡片）：border 转 `--border-light` + `--shadow-md`，260ms；
- 浮层（气泡/下拉/popover）：`--bg-elevated` + `--border-light` + `--radius-xl` + `--shadow-md`；玻璃拟态浮层（ModLog、hover-bubble）：`backdrop-filter: blur(16px)` + 底色透明度 **≥80%**（暗色下用 `rgba(30,30,40,.85)`）；
- 弹窗：overlay `rgba(0,0,0,.55)`，dialog `--radius-xl` + `--shadow-xl`，入场 `opacity 0→1 + translateY(8px→0)` 260ms var(--ease-out)。

### 4.5 徽标 / Chip / 输入框

- 类型徽标：语义底色(12%) + 语义亮色文本 + `--radius-sm` + 10-11px 字号 + 大写或中文 2-4 字；
- 引用 chip（chat-reference / ref- 确认条）：`--bg-elevated` + `--border` + `--radius-full` + 📎 换 Lucide `Paperclip` 图标；
- 输入框：`--bg-input` + `1px --border` + `--radius-base`；focus：border 转 `--brand` + `box-shadow: 0 0 0 3px rgba(99,102,241,.18)`；150ms；错误态 border `--error`。

---

## 5. 标志性视觉元素（品牌 IP 记忆点）

### 5.1 品牌渐变标记（Logo Dot）

应用内所有"品牌位"（文档指示点、Logo、空状态装饰）统一使用渐变圆点：

```css
.brand-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--brand-gradient);
  box-shadow: 0 0 8px rgba(99,102,241,.5);
}
```

### 5.2 Diff 四色光谱条（签名式元素）

四色 1:1:1:1 渐变细条，作为"变更"场景的签名装饰——Diff 工具条下沿、版本时间线主轴、空状态插画底部：

```css
.diff-spectrum {
  height: 2px;
  background: linear-gradient(90deg,
    var(--diff-add) 0 25%, var(--diff-del) 25% 50%,
    var(--diff-replace) 50% 75%, var(--diff-reorder) 75% 100%);
  opacity: .8;
}
```
版本时间线主轴升级：左侧竖线由纯色改为 2px 四色光谱（`linear-gradient(180deg, …四色)`），当前版本节点用品牌渐变实心圆 + 外发光。

### 5.3 动效语言

- **统一曲线**：`--ease-out: cubic-bezier(0.16,1,0.3,1)`（既有 token，全产品唯一曲线）；
- **时长档位**：微交互 120-150ms（hover/press）、面板滑入滑出 260ms（ModLog/弹层）、视图切换 ≤300ms；**禁止超过 300ms 的 UI 过渡**；
- **签名动效「流式光标」**：AI 生成态的 typing-cursor（既有）升级为品牌渐变呼吸块：
```css
.typing-cursor {
  display: inline-block; width: 8px; height: 16px; border-radius: 2px;
  background: var(--brand-gradient);
  animation: ps-breathe 1s var(--ease-out) infinite;
}
@keyframes ps-breathe { 50% { opacity: .25; } }
```
- 变更块被接受时：行底色从类型色 200ms 淡出到 `--diff-add-bg` + 左侧 2px 绿条定格——"修改落地"的仪式感（Diff 既有 accepted-line 上增强）。

### 5.4 空状态插画语言

统一"线性 SVG + 单品牌色点缀"风格（现有 chat-empty 已是此风格，推广到全部空状态）：
- 1.5px 描边线性图标（Lucide 风格一致）、`--text-muted` 40% 透明度；
- 唯一彩色元素 = 品牌渐变点/四色光谱条；
- 文案两段式：主句（13px `--text-secondary`）+ 引导句（11px `--text-muted`）。

---

## 6. 交互规范（三态统一模式）

### 6.1 加载态

| 场景 | 模式 | 实现 |
|---|---|---|
| 按钮内操作（测试连接等） | 按钮内 spinner + 文案「测试中…」，宽度不变 | 14px 圆环 spinner：`border: 2px solid rgba(255,255,255,.25); border-top-color: #fff; animation: ps-spin .7s linear infinite` |
| 面板/列表内容加载（版本摘要生成等） | **骨架屏**（不用 spinner） | `.skeleton`：`--bg-elevated` 底 + 渐变扫光 `@keyframes ps-shimmer { background-position: -200px→200px }`，1.2s |
| AI 流式输出 | 流式光标（§5.3） | 既有机制升级样式 |
| 整页/初始化 | 品牌渐变点三点脉冲 | 三点 stagger 120ms opacity 脉冲 |

### 6.2 错误/提示

| 级别 | 通道 | 规范 |
|---|---|---|
| 阻断性操作反馈（提取失败、未圈选等） | **toast**（右上角，3s 自隐） | 统一走 `toast(message, type)`；error 左边条 `--error`、success `--success`、info `--brand`；禁止 alert() |
| 表单/设置内错误 | **inline** 文案（输入框下方 11px `--error`）| 不弹 toast，错误随修正即时消失 |
| 全局性状态（校验错误数） | 既有黄色横幅 | 保留；文案格式统一「⚠ 存在 N 处错误，M 处警告 — 规则冲突需处理」（⚠ 为文本字符，可保留） |
| 二次确认 | ConfirmDialog（新流程）/ confirm()（遗留，T05 逐步替换） | 危险按钮用 btn-danger |

### 6.3 空数据占位

统一 §5.4 插画语言 + 两段式文案；必须给出"下一步动作"（按钮或快捷键提示），不做纯装饰空态。清单：无版本 / 无对话 / 无工作区 / 无校验问题（✓ 正向空态，用 `--success` 色 CheckCircle）。

---

## 7. 响应式规范

工作台为桌面优先工具，断点策略 = "可用下限保护 + 宽屏增强"：

| 断点 | 策略 |
|---|---|
| **<1024px** | 显示提示条「PromptStudio 为桌面工作台设计，建议窗口宽度 ≥1024px」；功能不裁切但允许横向挤压 |
| **1024px**（基准） | Chat 面板固定 360px；校验面板 280px；编辑器 min-width 0 自适应收缩 |
| **1280px** | Chat 面板 400px；Diff 双 pane 等宽不变 |
| **1440px+** | Chat 面板上限 440px；编辑器内容区 max-width 居中（可选，保持行长可读性 ≤120 字符与校验规则一致） |
| **375/768（移动/平板）** | 本期不做移动适配（本地优先桌面工具定位），仅保证提示条可用、不白屏 |

实现：CSS 变量驱动面板宽度（`--chat-panel-width` 等），媒体查询只改变量不改结构。

---

## 8. 禁区清单（Forbidden）

1. **禁止 emoji 充当功能图标**——一律 Lucide（现有 🤖👤🧠📌↺ 等在 T05 全部替换：Bot/User/Brain/Pin/RotateCcw）；文案内的 ⚠/✓/✗ 文本符号允许保留；
2. **hover 禁止引发布局位移**——不得改变 border 宽度、padding、font-weight；只能改背景/颜色/阴影（用透明 border 或 box-shadow 预留位）；
3. **玻璃拟态透明度下限**——暗色主题 `backdrop-filter` 浮层的底色 alpha ≥ 0.8（现有 55% 遮罩仅限全屏 overlay，浮层本体必须 ≥80% 保证可读）；
4. **Diff 四色禁止改义/混用**——绿色不出现在"删除"、蓝色不做成功提示等；新增第五种变更色需走品牌评审；
5. **禁止超 300ms 的过渡动画**、禁止 ease/bounce 等弹性曲线用于工作台内（浮夸感）；
6. **禁止新增字体家族**（Inter + JetBrains Mono 之外不引入）、禁止正文字号 <11px；
7. **禁止组件内硬编码 hex 色值**（数据驱动的 provider iconBg 除外）——一律 CSS 变量；
8. **禁止阴影堆叠两层以上**（悬浮感过强 = "AI 味"来源之一）；
9. **对比度底线**：信息文本 ≥4.5:1，T05 统一将 `--text-muted` 从 `#6A6A7A` 上调至 `#8A8A9A` 并回归检查；
10. **禁止在滚动容器内使用 100vh 定位浮层**（Diff overlay 已有定位上下文，新浮层一律 fixed + portal 或相对最近定位祖先）。

---

## 9. 落地映射（T05 执行清单）

| 动作 | 位置 |
|---|---|
| `--text-muted` 上调 `#8A8A9A`；新增 `--brand-gradient`/`--radius-xl`/`--shadow-brand`/`--font-size-num` | `src/styles/index.css` :root |
| index.html 引入 Inter + JetBrains Mono | `index.html` |
| btn-primary 改品牌渐变底；全按钮 hover 去位移审计 | `.btn*` |
| 版本时间线主轴改四色光谱；新增 `.brand-dot`/`.diff-spectrum`/`.skeleton`/`ps-spin`/`ps-breathe` | `index.css` 新增节 |
| emoji 图标 → Lucide 替换（ChatPanel 🤖👤🧠、TopBar ◧、ModLog 📌 等） | 各组件 tsx |
| 遗留 `alert()` → toast（TopBar L49 等） | 各组件 tsx |
| 面板宽度变量化 + 1024/1280/1440 媒体查询 | `index.css` |
