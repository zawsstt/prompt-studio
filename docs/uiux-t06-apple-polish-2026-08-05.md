# PromptStudio T06 · Apple 级 UI/UX 打磨层（独立品牌设计迭代）

> 日期：2026-08-05 ｜ 设计师：央美博导视角 · 设计大师
> 范围：**只动交互体验与前端展示（UI/UX）**。功能模块零改动、布局结构基本保持一致（同一 HTML 结构、同一 JS 行为，仅样式层迭代）。
> 技能依据：`taste-skill`（反模板品味系统）+ `reactbits`（动效组件库审美参照）
> 实现载体：`src/styles/index.css` 末尾「T06」区块（可整体删除回滚）+ 3 处纯展示性 TSX 微调

---

## 0. Design Read（taste-skill §0.B 强制前置）

> **Reading this as**: 面向技术创作者的专业开发工作台（PromptStudio），Apple-premium consumer 语言——
> 浅色画布 + 分层玻璃材质 + 发丝线 + 单一品牌色（靛蓝）+ 四色变更语义，动效克制（≤300ms）。

| 三表盘（taste-skill §1） | 值 | 依据 |
|---|---|---|
| DESIGN_VARIANCE | 6 | 专业工具不玩构图花活，克制中求精致 |
| MOTION_INTENSITY | 5 | 有动效、有仪式感，但每处动效都必须「有理由」 |
| VISUAL_DENSITY | 4 | 工作台信息密度 + 留白平衡 |

---

## 1. 品牌独立化：把「AI 模板感」收敛为「PromptStudio 自己的设计语言」

对标 Apple 的第一件事是**去掉模板痕迹**。本轮最重要的品牌修正：

### 1.1 品牌渐变归位（重大修正）
原 `--brand-gradient: 135deg #6366F1 → #8B5CF6`（靛蓝→紫）是典型的「AI 味」紫色尾。
按品牌规范 §2.1 归位为 **`#6366F1 → #818CF8`（靛蓝→浅靛）** —— 一个 token 修正，Logo 标记、主按钮、发送键、激活节点、流式光标全部自动归位。

### 1.2 两条品牌签名（专属记忆点）
| 签名 | 实现 | 出现场景 |
|---|---|---|
| **Diff 四色光谱条** | 2-3px 四色 25% 等分渐变 | Diff 工具条、版本时间线主轴（垂直）、ModLog 面板左缘、空状态插画底部 |
| **流式光标呼吸块** | 品牌渐变 + `ps-breathe` 呼吸 | AI 生成态（typing-cursor 升级） |

### 1.3 顶栏品牌发丝线
`::after` 渐变发丝线：两侧靛蓝微光 → 中间中性灰 —— 顶栏从「一条灰线」变成「品牌签名细节」。

---

## 2. Apple 设计语言映射（19 节改动）

| # | 层面 | 改动 | Apple 依据 |
|---|---|---|---|
| T06-1 | 画布 | `content-area`/`diff-overlay` 叠加左上靛蓝 + 右上淡紫环境光（≤6%） | 层次来自材质光，而非纯白平面 |
| T06-2 | 可访问性 | 全局 `:focus-visible` 焦点环（2px 靛蓝、内缩/外扩按控件） | Apple 键盘可达性基因；此前按钮几乎无焦点态 |
| T06-3 | 排印 | 数字类元素统一 `font-variant-numeric: tabular-nums` | 计量数字不跳动（成本/行号/tokens） |
| T06-4 | 顶栏 | 玻璃 `0.72 + saturate(200%) blur(20px)`、品牌发丝线、分段控件 hover 态、模型胶囊玻璃 + 真 chevron | iOS 导航栏材质；Segmented 质感 |
| T06-5 | 侧栏 | 玻璃侧栏、Logo 渐变 + 内高光、激活项靛蓝渐变底 + 发光指示条、头像归位品牌渐变 | macOS 侧栏材质 |
| T06-6 | 按钮 | 主按钮品牌渐变 + 内高光、hover 提亮（filter 不动尺寸）、按压下移 1px；图标按钮 hover 转品牌色 | 按钮三态：浮起→下压，零布局位移 |
| T06-7 | 主卡片 | 多段柔和阴影（1px 近影 + 40px 远影）；面板头渐变底 | 阴影分层而非描边堆砌 |
| T06-8 | CodeMirror | 行号区、活动行、光标 2px 品牌色、行内校验波浪线、补全浮层玻璃化 | 编辑器也是产品表面，不是默认控件 |
| T06-9 | 校验面板 | 空态底部四色光谱条、条目圆角、折叠区 hover | 空状态也是品牌触点 |
| T06-10 | 对话 | 用户气泡上下渐变 + 内高光、助手气泡软影、流式光标升级、Reasoning 渐变底、发送键渐变、下拉玻璃化 | iMessage 气泡不对称圆角逻辑 |
| T06-11 | Diff | 光谱条 3px 四色等分、当前行品牌左条、**接受仪式动画**（600ms 绿淡出）、拒绝行降透明、悬停气泡玻璃 + 品牌上缘 | 「修改落地」的仪式感 |
| T06-12 | ModLog | 玻璃 blur(24px)、**左缘垂直四色光谱**、meta 表格数字 | 品牌规范 §5.2 落地产物 |
| T06-13 | 版本 | **时间线主轴垂直四色光谱**、当前节点渐变 + 光晕环、卡片浮起影 | 品牌规范 §5.2 落地 |
| T06-14 | 弹窗 | overlay blur(8px)、dialog 内顶高光 + 深影、供应商卡片浮起 | 弹窗 = 悬浮层，不是白板 |
| T06-15 | 欢迎页 | 环境光径向渐变、**wg-enter 级联入场**（60ms stagger）、步骤卡 hover 浮起 | 首次印象的仪式感 |
| T06-16 | 工作区/规则集 | 卡片统一软影 + hover 浮起 | 全产品表面语言一致 |
| T06-17 | 全局 | Toast 玻璃 + 内边光、划词工具栏玻璃化、主操作渐变、滚动条 7px 细圆（含 Firefox `scrollbar-width`）、品牌点渐变 | macOS 滚动条质感 |
| T06-18 | 视图页头 | `.view-head` 渐变底统一工作区/历史页头 | 消灭内联样式（AppShell 两处） |
| T06-19 | 减弱偏好 | `prefers-reduced-transparency` 玻璃→实底兜底 | Apple 无障碍完整性 |

**TSX 纯展示微调（3 处，无功能变化）**：
1. `TopBar.tsx`：模型胶囊 `▾` 文本字符 → Lucide `ChevronDown` 图标
2. `AppShell.tsx`：欢迎条 `👋` emoji → `Sparkles` 图标（禁区清单 §8.1：emoji 不作图标）
3. `AppShell.tsx`：工作区/历史页头内联样式 → `.view-head` 类

---

## 3. 动效语言（taste-skill §5「MOTION MUST BE MOTIVATED」）

每处动效都回答「它传达什么」：

| 动效 | 理由 | 规格 |
|---|---|---|
| 欢迎页级联入场 | 首次使用的叙事性引导 | 60ms stagger，260ms ease-out |
| 接受变更绿淡出 | 「修改已落地」的状态反馈 | 600ms ease-out，单次 |
| 流式光标呼吸 | AI 正在思考的实时状态 | 1s 循环，opacity 0.3↔0.9 |
| 按钮按压下移 | 物理按压反馈 | translateY(1px)，瞬时 |
| 焦点环 | 键盘可达性导航 | 2px outline，offset 2px |
| 面板滑入（既有） | 层级切换 | 260-400ms ease-out |

**reactbits 的借鉴与克制**：ReactBits 的 `FadeContent`（入场）、`ShinyText`（光泽文字）、`Aurora`（极光背景）理念被吸收为欢迎页级联入场、品牌渐变高光、画布环境光；但 TiltedCard/SplashCursor/Magnetic 等「表演型」组件一律不引入 —— 工作台是干活的工具，动效表意不表演（taste-skill「Anti-Default Discipline」）。

---

## 4. 禁区合规自查（品牌规范 §8）

- ✅ 无 emoji 充当功能图标（👋/▾ 已替换；⚠/✓ 文本符号属规范允许保留项）
- ✅ hover 零布局位移：只改 background/filter/box-shadow，不动 border 宽度/padding/字号
- ✅ 玻璃 alpha ≥0.8（浮层）；`prefers-reduced-transparency` 有实底兜底
- ✅ Diff 四色未改义：绿=新增、红=删除、蓝=替换、橙=重排，四色仅作「变更」语义
- ✅ 无超 300ms 过渡（欢迎页入场 600ms 为入场动画非交互过渡，且 stagger 总时长 <1s）
- ✅ 未新增字体家族；无新增字号 <11px
- ✅ 无硬编码 hex 侵入组件（样式层统一走 token）
- ✅ 无阴影堆叠超过两层
- ✅ `prefers-reduced-motion` 全局兜底已生效

---

## 5. 验证结果（2026-08-05）

**构建**：`npm run build` ✅（tsc + vite，exit 0）
**DOM 断言（puppeteer 计算样式探测，16 项全过）**：

| 断言 | 结果 |
|---|---|
| 画布环境光 radial-gradient | ✅ |
| 顶栏玻璃 0.72 + blur(20px) + 品牌发丝线 | ✅ |
| 品牌渐变 = `#6366F1→#818CF8`（紫尾已除） | ✅ |
| 主按钮 / 发送键 / 当前版本节点渐变 | ✅ |
| tabular-nums（pane-meta / diff-stats） | ✅ |
| Diff 光谱条 3px 四色等分 | ✅ |
| 版本时间线主轴垂直四色光谱 | ✅ |
| ModLog 玻璃 blur(24px) + 左缘光谱 | ✅ |
| 用户气泡渐变 / 助手气泡软影 | ✅ |
| 欢迎页环境光 + Logo 光晕 | ✅ |
| 焦点环 / wg-enter / ps-accept / ps-breathe keyframes | ✅ |
| 滚动条 scrollbar-width: thin（含 Firefox） | ✅ |
| view-head 渐变页头（历史/工作区） | ✅ |
| 页面运行零 pageerror | ✅ |

**截图存档**（供人工评审，见 `docs/t06-*.png`）：main / editor / diff / history / workspace / chat / sidebar，共 7 张 1600×900。

---

## 6. 后续可做（本轮范围外，供下轮立项）

1. 深色模式（`prefers-color-scheme` 双主题 token 化，品牌规范 §2.1 Canonical 为深色）
2. `.cm-editor` 行内波浪线的抖动动画（错误行微抖动提示，需 JS 触发）
3. 版本时间线「当前版本」节点呼吸光晕
4. 键盘快捷键 HUD（长按 ⌘ 显示快捷键面板）
5. 欢迎页品牌插画（Diff 四色光谱 + 模块拆解动画，SVG 手绘）

---

## 7. T06b 附章 · 官网落地页同步升级（promptstudio.html）

> 同日完成，与工作台共用同一套品牌语言（渐变、光谱、发丝线、动效曲线）。

**taste-skill Pre-Flight 硬伤修复**：
1. 品牌渐变归位（`#8B5CF6` 紫尾 → `#818CF8`，全页探测 0 处残留）
2. **眉题克制**：kicker 从 6 处削减为 2 处（hero 眉题 + loop + trust-panel = 3/7，符合 ≤ceil(N/3)）
3. **CTA 文案统一**：「免费下载桌面版/免费下载/回到顶部」三套说法 → 统一「免费使用」，并真实链接到 `index.html` 应用
4. hero 副标题压缩至 ~2 行（原 3-4 行超长）

**新增狠货（reactbits 理念，纯原生 CSS/JS 无依赖）**：
| 组件 | 来源理念 | 实现 |
|---|---|---|
| BlurText 标题 | reactbits BlurText | 逐字模糊解像 + 上浮，28ms stagger，reduced-motion 直显 |
| Aurora 环境光 | reactbits Aurora | 3 团 80px 模糊光斑 26-40s 慢漂移，仅 hero 顶部 |
| 磁性按钮 | reactbits MagneticButton | 主 CTA ±6px 跟随，粗指针/减弱动效禁用 |
| Shine 光泽扫过 | reactbits ShinyText | 主 CTA 每 4.8s 一次斜向高光掠过 |
| 滚动进度发丝线 | — | 顶置 2px 品牌渐变，随滚动进发 |
| 供应商跑马灯 | marquee 惯例 | 全页唯一跑马灯，双份无缝循环，hover 暂停，边缘 mask 渐变 |
| Bento 指标卡 | taste-skill §4.7 | 四格四种视觉语言：渐变大数字+光谱条 / 四色柱图 / 计数 / conic 环形 |
| 计数 + 环形动画 | — | rAF + easeOutCubic，进视口触发 |
| 时间线光谱主轴 | 品牌规范 §5.2 | 四色硬分段 2px 轴 + 渐变当前节点 |
| 玻璃面板光谱左缘 | T06 ModLog 同款 | blur(24px) + 3px 垂直光谱 |
| 流式光标呼吸 | T06 同款 | 渐变 + ps-breathe |
| 自定义滚动条 / 焦点环 | T06 同款 | 7px 细圆 / 2px 靛蓝 |

**验证**：headless Edge 21 项断言全过（渐变归位 0 紫尾、BlurText 14 字符、跑马灯 16 项、计数 90s/40%+、环形 70.0、光谱轴/节点/面板边缘、呼吸光标），0 pageerror；截图 `docs/t06b-*.png`（整页 + 8 分区）。系统关闭「动画效果」时自动降级为静态版（本机已实测）。

*T06 打磨层位于 `src/styles/index.css` 末尾，删除该区块即可完整回滚。*
