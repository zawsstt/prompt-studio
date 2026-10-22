# PromptStudio 网页设计方案

> **集成式 Prompt 编辑应用 — 专业级 UI/UX 设计系统**  
> 版本：v1.0 | 日期：2026-08-06

---

## 1. 设计理念与品牌定位

### 1.1 核心设计哲学

**专业工具的视觉语言**：PromptStudio 是面向 AI 工程师、Prompt 开发者的专业工作台，设计需传达：
- **精准控制感**：用户是决策者，每个操作都可预见、可撤销
- **信息密度与呼吸感平衡**：承载复杂功能但不拥挤
- **信任与透明**：修改过程可视化、理由可追溯

**从 Logo 提取的视觉基因**：
- **网格化结构**：Logo 左侧的 3×3 网格象征模块化、结构化
- **橙色光晕渐变**：活跃状态、智能辅助的视觉隐喻
- **蓝紫色轮廓**：专业、冷静、技术感
- **柔和圆角**：专业但易接近，非僵硬工业风

### 1.2 目标用户体验关键词

| 维度 | 关键词 | 设计体现 |
|------|--------|----------|
| 情感 | 可控、自信、专注 | 清晰的状态反馈、可预测的交互 |
| 效率 | 流畅、直达、零摩擦 | ≤2 次点击完成高频操作 |
| 美学 | 现代、精致、克制 | 深色主题、精确间距、微妙动效 |
| 信任 | 透明、可逆、诚实 | Diff 高亮、修改说明、一键回滚 |

---

## 2. 色彩系统 (Color Palette)

### 2.1 主色调 (Primary Colors)

基于 Logo 提取，符合专业工具调性：

```css
/* 品牌主色 - 橙色渐变系统 */
--brand-orange-900: #C2410C;  /* 深橙，按钮 hover */
--brand-orange-600: #EA580C;  /* 标准橙，Logo 主色 */
--brand-orange-500: #F97316;  /* 亮橙，CTA 主按钮 */
--brand-orange-400: #FB923C;  /* 柔橙，辅助高亮 */
--brand-orange-glow: radial-gradient(circle, rgba(249,115,22,0.4) 0%, rgba(249,115,22,0) 70%);

/* 品牌辅助色 - 蓝紫系统 */
--brand-indigo-800: #3730A3;  /* Logo 轮廓色 */
--brand-indigo-600: #4F46E5;  /* 次要按钮、链接 */
--brand-indigo-400: #818CF8;  /* 悬停状态 */
```

### 2.2 功能色 (Semantic Colors)

```css
/* 变更类型着色（对应 Diff 对比） */
--diff-added: #16A34A;        /* 新增块 - 绿 */
--diff-added-bg: rgba(22,163,74,0.15);
--diff-removed: #DC2626;      /* 删除块 - 红 */
--diff-removed-bg: rgba(220,38,38,0.15);
--diff-replaced: #2563EB;     /* 替换块 - 蓝 */
--diff-replaced-bg: rgba(37,99,235,0.15);
--diff-reordered: #D97706;    /* 重排块 - 橙 */
--diff-reordered-bg: rgba(217,119,6,0.15);

/* 状态色 */
--success: #10B981;
--warning: #F59E0B;
--error: #EF4444;
--info: #3B82F6;
```

### 2.3 中性色基础 (Neutrals - 深色主题优先)

```css
/* 深色主题（默认） */
--bg-primary: #0B0E14;        /* 主背景 - 深海军蓝 */
--bg-secondary: #151922;      /* 次级背景 - 编辑器、侧边栏 */
--bg-tertiary: #1E293B;       /* 三级背景 - 卡片、面板 */
--bg-elevated: #2D3748;       /* 浮起元素 - 弹窗、Tab */
--bg-glass: rgba(30,41,59,0.55); /* 毛玻璃遮罩 */

--text-primary: #F8FAFC;      /* 主文本 */
--text-secondary: #CBD5E1;    /* 次要文本 */
--text-tertiary: #94A3B8;     /* 提示文本 */
--text-muted: #64748B;        /* 禁用文本 */

--border-default: #334155;    /* 默认边框 */
--border-subtle: #1E293B;     /* 微妙分割线 */
--border-focus: #4F46E5;      /* 焦点边框 */
```

### 2.4 浅色主题映射

```css
/* 浅色主题（可选） */
[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8FAFC;
  --bg-tertiary: #F1F5F9;
  --bg-elevated: #FFFFFF;
  --bg-glass: rgba(248,250,252,0.8);
  
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-tertiary: #64748B;
  
  --border-default: #E2E8F0;
  --border-subtle: #F1F5F9;
}
```

---

## 3. 排版系统 (Typography)

### 3.1 字体选择

```css
/* UI 界面字体 */
--font-ui: "Inter", "SF Pro Display", "PingFang SC", "Microsoft YaHei", sans-serif;

/* 代码/编辑器字体 */
--font-mono: "JetBrains Mono", "Cascadia Code", "Consolas", "PingFang SC", monospace;

/* 展示/标题字体（可选增强） */
--font-display: "Sora", "Inter", sans-serif;
```

### 3.2 字阶系统 (Type Scale)

```css
/* 标题层级 */
--text-5xl: 3rem;      /* 48px - 大标题（营销页） */
--text-4xl: 2.25rem;   /* 36px - 页面主标题 */
--text-3xl: 1.875rem;  /* 30px - 区块标题 */
--text-2xl: 1.5rem;    /* 24px - 卡片标题 */
--text-xl: 1.25rem;    /* 20px - 小节标题 */
--text-lg: 1.125rem;   /* 18px - 强调文本 */

/* 正文层级 */
--text-base: 1rem;     /* 16px - 标准正文 */
--text-sm: 0.875rem;   /* 14px - 辅助文本 */
--text-xs: 0.75rem;    /* 12px - 标签、徽章 */
--text-2xs: 0.6875rem; /* 11px - 元信息 */

/* 行高 */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### 3.3 应用规范

| 场景 | 字体 | 大小 | 字重 | 颜色 |
|------|------|------|------|------|
| 顶栏导航 | UI | 14px | 500 | text-secondary |
| 页面标题 | Display | 30px | 600 | text-primary |
| 卡片标题 | UI | 18px | 600 | text-primary |
| 正文内容 | UI | 16px | 400 | text-primary |
| 代码编辑器 | Mono | 14px | 400 | text-primary |
| 按钮文本 | UI | 14px | 500 | 根据按钮类型 |
| 标签徽章 | UI | 12px | 500 | text-tertiary |
| 元信息 | UI | 11px | 400 | text-muted |

---

## 4. 间距与布局系统 (Spacing & Layout)

### 4.1 间距标尺 (Spacing Scale)

采用 8px 基础网格系统：

```css
--space-0: 0;
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
--space-20: 5rem;     /* 80px */
--space-24: 6rem;     /* 96px */
```

### 4.2 布局网格

```css
/* 主布局容器宽度 */
--container-sm: 640px;
--container-md: 768px;
--container-lg: 1024px;
--container-xl: 1280px;
--container-2xl: 1536px;

/* 应用内布局 */
--sidebar-width: 280px;        /* 文件树 */
--sidebar-collapsed: 64px;     /* 折叠态 */
--chat-panel-min: 320px;       /* AI 对话面板最小宽度 */
--chat-panel-default: 420px;   /* 默认宽度 */
--chat-panel-max: 640px;       /* 最大宽度 */
--detail-tab-width: 420px;     /* 修改日志 Tab */
--topbar-height: 64px;         /* 顶栏高度 */
```

### 4.3 圆角系统 (Border Radius)

```css
--radius-none: 0;
--radius-sm: 0.25rem;   /* 4px - 标签 */
--radius-md: 0.375rem;  /* 6px - 按钮 */
--radius-lg: 0.5rem;    /* 8px - 卡片 */
--radius-xl: 0.75rem;   /* 12px - 面板 */
--radius-2xl: 1rem;     /* 16px - 弹窗 */
--radius-full: 9999px;  /* 圆形元素 */
```

### 4.4 阴影系统 (Elevation)

```css
/* 深色主题阴影 */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.25);
--shadow-md: 0 4px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.35), 0 4px 6px rgba(0,0,0,0.25);
--shadow-xl: 0 20px 25px rgba(0,0,0,0.4), 0 8px 10px rgba(0,0,0,0.3);
--shadow-2xl: 0 25px 50px rgba(0,0,0,0.5);

/* 橙色光晕阴影（品牌特色） */
--shadow-glow-orange: 0 0 24px rgba(249,115,22,0.4), 0 0 48px rgba(249,115,22,0.2);
--shadow-glow-indigo: 0 0 24px rgba(79,70,229,0.3), 0 0 48px rgba(79,70,229,0.15);
```

---

## 5. 组件设计规范 (Component Specifications)

### 5.1 按钮 (Buttons)

#### 主按钮 (Primary CTA)

```css
.btn-primary {
  background: linear-gradient(135deg, var(--brand-orange-600), var(--brand-orange-500));
  color: white;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 14px;
  box-shadow: var(--shadow-md);
  transition: all 150ms ease-out;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--brand-orange-700), var(--brand-orange-600));
  box-shadow: var(--shadow-lg), var(--shadow-glow-orange);
  transform: translateY(-1px);
}

.btn-primary:active {
  transform: translateY(0);
  box-shadow: var(--shadow-sm);
}
```

#### 次要按钮 (Secondary)

```css
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  padding: 12px 24px;
  border-radius: var(--radius-md);
  transition: all 150ms ease-out;
}

.btn-secondary:hover {
  background: var(--bg-elevated);
  border-color: var(--brand-indigo-600);
}
```

#### 图标按钮

```css
.btn-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 150ms;
}

.btn-icon:hover {
  background: var(--bg-tertiary);
}
```

### 5.2 输入框 (Input Fields)

```css
.input-field {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
  transition: all 150ms;
}

.input-field:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.15);
}

.input-field::placeholder {
  color: var(--text-muted);
}
```

### 5.3 卡片 (Cards)

```css
.card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: all 200ms ease-out;
}

.card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.card-interactive {
  cursor: pointer;
}
```

### 5.4 标签徽章 (Badges/Tags)

```css
/* 文件标签（引用确认条） */
.file-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-full);
  padding: 4px 12px 4px 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.file-tag--confirmed {
  border-color: var(--success);
  background: rgba(16,185,129,0.1);
}

.file-tag--pending {
  border-color: var(--warning);
  background: rgba(245,158,11,0.1);
}

/* 状态徽章 */
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge--success { background: rgba(16,185,129,0.15); color: var(--success); }
.badge--warning { background: rgba(245,158,11,0.15); color: var(--warning); }
.badge--error { background: rgba(239,68,68,0.15); color: var(--error); }
.badge--info { background: rgba(59,130,246,0.15); color: var(--info); }
```


### 5.5 Diff 高亮块 (Diff Highlight Blocks)

```css
/* 变更块基础样式 */
.diff-block {
  position: relative;
  border-radius: var(--radius-md);
  padding: 12px;
  margin: 8px 0;
  border-left: 3px solid transparent;
  transition: all 200ms ease-out;
}

/* 新增块 */
.diff-block--added {
  background: var(--diff-added-bg);
  border-left-color: var(--diff-added);
}

/* 删除块 */
.diff-block--removed {
  background: var(--diff-removed-bg);
  border-left-color: var(--diff-removed);
  text-decoration: line-through;
  opacity: 0.7;
}

/* 替换块 */
.diff-block--replaced {
  background: var(--diff-replaced-bg);
  border-left-color: var(--diff-replaced);
}

/* 重排块 */
.diff-block--reordered {
  background: var(--diff-reordered-bg);
  border-left-color: var(--diff-reordered);
}

/* 悬停态 */
.diff-block:hover {
  box-shadow: var(--shadow-md);
  transform: scale(1.01);
}

/* 已接受/已拒绝状态 */
.diff-block--accepted::after {
  content: "✓";
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--success);
  font-size: 18px;
}

.diff-block--rejected::after {
  content: "✗";
  position: absolute;
  top: 8px;
  right: 8px;
  color: var(--error);
  font-size: 18px;
}
```

### 5.6 气泡提示 (Tooltip Bubble)

```css
.tooltip-bubble {
  position: absolute;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 8px 14px;
  font-size: 13px;
  color: var(--text-secondary);
  box-shadow: var(--shadow-lg);
  white-space: nowrap;
  pointer-events: auto;
  cursor: pointer;
  transition: all 150ms ease-out;
  z-index: 50;
}

.tooltip-bubble::before {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  border-style: solid;
  border-width: 6px 6px 0 6px;
  border-color: var(--bg-elevated) transparent transparent transparent;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
}

.tooltip-bubble:hover {
  background: var(--brand-indigo-600);
  color: white;
  transform: scale(1.05);
}
```

### 5.7 毛玻璃面板 (Glassmorphism Panel)

```css
/* 修改日志 Tab 核心样式 */
.glass-panel {
  position: fixed;
  right: 0;
  top: var(--topbar-height);
  bottom: 0;
  width: var(--detail-tab-width);
  background: var(--bg-glass);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border-left: 1px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-2xl);
  transform: translateX(100%);
  transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
  z-index: 100;
  overflow-y: auto;
}

.glass-panel--open {
  transform: translateX(0);
}

/* 浅色主题调整 */
[data-theme="light"] .glass-panel {
  background: rgba(248,250,252,0.8);
  border-left-color: rgba(0,0,0,0.1);
}
```

---

## 6. 页面布局设计 (Page Layouts)

### 6.1 主工作台布局 (Main Workspace)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Topbar (64px)                                                      │
│  [Logo] PromptStudio · 主Agent         [规则集▾] [自动整理] [⚙]  │
├──────────┬─────────────────────────────────────┬────────────────────┤
│          │                                     │                    │
│ Sidebar  │         Editor Area                 │  AI Chat Panel     │
│ (280px)  │      (CodeMirror 编辑器)            │  (420px 可调)      │
│          │                                     │                    │
│ 📁 文件树 │  1  # Prompt 主体内容               │  💬 消息列表        │
│  ├ 主agent│  2  frontmatter: name...           │  ┌────────────┐   │
│  ├ 助手A  │  3                                  │  │ User Msg   │   │
│  └ 助手B  │  4  ## Instructions                 │  └────────────┘   │
│          │  5  You are...                      │  ┌────────────┐   │
│ ⏱ 版本   │     ~~~~~~~~~~~~ (校验波浪线)        │  │ AI Reply   │   │
│  v1→v2→v3│  6                                  │  │ [应用为候选]│   │
│          │  7  ## Examples                     │  └────────────┘   │
│          │                                     │                    │
│          │                                     │  [模型选择▾]       │
│          │  右侧错误面板 (折叠式)               │  [发送]           │
│          │  ⚠ 缺少 name 字段                   │                    │
└──────────┴─────────────────────────────────────┴────────────────────┘
```

**关键尺寸**：
- Topbar 固定高度：64px
- Sidebar 默认宽度：280px，可折叠至 64px（仅图标）
- Editor 自适应剩余空间
- Chat Panel 可拖拽调整：320px ~ 640px

### 6.2 对比视图布局 (Diff Comparison View)

```
┌─────────────────────────────────────────────────────────────────────┐
│  工具栏 (56px)                                                       │
│  [✓接受全部] [✗拒绝全部]  [◀ 上一处] [下一处 ▶]  |  3 处修改 · +12 -4│
├──────────────────────────────┬──────────────────────────────────────┤
│  v1 · 修改前                  │  v2 · 候选修改                        │
│  ┌──────────────────────┐   │  ┌──────────────────────┐            │
│  │ ## Instructions      │   │  │ ## Instructions      │            │
│  │                      │   │  │                      │            │
│  │ You should follow... │   │  │ You must follow...   │ ◄─ 替换块  │
│  └──────────────────────┘   │  └──────────────────────┘   (蓝色)   │
│                              │    ↑ 悬停 150ms → 气泡出现            │
│  (删除块 - 红色划线)          │  (新增块 - 绿色背景)                  │
│                              │                                      │
│  同步滚动                     │  同步滚动                             │
└──────────────────────────────┴──────────────────────────────────────┘
                                       ↓ 点击气泡
                            ┌──────────────────────┐
                            │  修改日志 Tab         │
                            │  (毛玻璃，右侧滑入)   │
                            │  ⚡ 类型：替换         │
                            │  📍 位置：第 5 行     │
                            │  🎯 Why: ...         │
                            │  🔧 How: ...         │
                            │  ✨ Effect: ...      │
                            │  [接受] [拒绝]       │
                            └──────────────────────┘
```

**交互流程**：
1. 进入对比视图：左右 50/50 分屏
2. 变更块高亮：新增绿、删除红、替换蓝、重排橙
3. 悬停触发：≥150ms 显示气泡"查看修改详情"
4. 点击气泡：右侧滑入毛玻璃 Tab（260ms 动画）
5. 点击外部：Tab 收起（防误触规则：仅空白区域触发）

### 6.3 版本时间线视图 (Version Timeline)

```css
/* 时间线容器 */
.version-timeline {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
}

/* 版本节点 */
.version-node {
  display: flex;
  align-items: start;
  gap: var(--space-4);
  position: relative;
}

.version-node::before {
  /* 连接线 */
  content: "";
  position: absolute;
  left: 19px;
  top: 40px;
  bottom: -16px;
  width: 2px;
  background: var(--border-default);
}

.version-node:last-child::before {
  display: none;
}

/* 版本圆点 */
.version-dot {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  border: 3px solid var(--brand-indigo-600);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
  flex-shrink: 0;
  box-shadow: var(--shadow-md);
}

.version-dot--current {
  border-color: var(--brand-orange-500);
  box-shadow: var(--shadow-glow-orange);
}

/* 版本信息卡片 */
.version-card {
  flex: 1;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all 200ms;
}

.version-card:hover {
  border-color: var(--brand-indigo-600);
  box-shadow: var(--shadow-md);
}

.version-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
}

.version-card__title {
  font-weight: 600;
  color: var(--text-primary);
}

.version-card__time {
  font-size: 12px;
  color: var(--text-muted);
}

/* 摘要展开按钮（两级披露） */
.summary-toggle {
  background: var(--bg-secondary);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-md);
  padding: 8px 12px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 150ms;
}

.summary-toggle:hover {
  border-color: var(--brand-orange-500);
  color: var(--brand-orange-500);
}
```


---

## 7. 交互动效设计 (Interaction & Animation)

### 7.1 动效设计原则

**专业工具调性**：
- 快速响应（120-260ms）
- 功能性优先（提供状态反馈，非装饰）
- 减少弹跳（避免 bounce/elastic，保持专业感）
- 尊重 `prefers-reduced-motion`

### 7.2 核心动效规范

#### 7.2.1 过渡曲线 (Easing Functions)

```css
/* 标准缓动曲线 */
--ease-out: cubic-bezier(0.16, 1, 0.3, 1);      /* 滑入、展开 */
--ease-in: cubic-bezier(0.4, 0, 1, 1);          /* 收起、消失 */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);    /* 通用过渡 */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* 强调动作 */

/* 时长标准 */
--duration-fast: 120ms;
--duration-normal: 200ms;
--duration-slow: 260ms;
--duration-slower: 400ms;
```

#### 7.2.2 按钮交互动效

```css
.btn {
  transition: all var(--duration-fast) var(--ease-out);
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn:active {
  transform: translateY(0);
  transition-duration: 60ms;
}

/* 涟漪效果（点击反馈） */
.btn::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%);
  opacity: 0;
  transform: scale(0);
  transition: transform 400ms, opacity 300ms;
}

.btn:active::after {
  transform: scale(1.5);
  opacity: 1;
  transition-duration: 0ms;
}
```

#### 7.2.3 修改日志 Tab 动效

```css
/* 滑入动画 */
@keyframes slideInRight {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 滑出动画 */
@keyframes slideOutRight {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}

.glass-panel--open {
  animation: slideInRight var(--duration-slow) var(--ease-out);
}

.glass-panel--closing {
  animation: slideOutRight var(--duration-slow) var(--ease-in);
}

/* 内容渐入（级联） */
.glass-panel__content > * {
  opacity: 0;
  transform: translateY(8px);
  animation: fadeInUp 200ms var(--ease-out) forwards;
}

.glass-panel__content > *:nth-child(1) { animation-delay: 100ms; }
.glass-panel__content > *:nth-child(2) { animation-delay: 150ms; }
.glass-panel__content > *:nth-child(3) { animation-delay: 200ms; }

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### 7.2.4 气泡提示动效

```css
.tooltip-bubble {
  opacity: 0;
  transform: scale(0.9) translateY(4px);
  transition: all 150ms var(--ease-out);
  pointer-events: none;
}

.tooltip-bubble--visible {
  opacity: 1;
  transform: scale(1) translateY(0);
  pointer-events: auto;
  transition-delay: 150ms; /* 防抖延迟 */
}

.tooltip-bubble--hiding {
  opacity: 0;
  transform: scale(0.95) translateY(2px);
  transition-delay: 400ms; /* 移出后延迟消失 */
}
```

#### 7.2.5 Diff 块悬停动效

```css
.diff-block {
  transition: all 200ms var(--ease-out);
  position: relative;
}

.diff-block::before {
  /* 左侧光晕指示条 */
  content: "";
  position: absolute;
  left: -3px;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 80%;
  background: linear-gradient(to bottom, 
    transparent, 
    var(--brand-orange-500), 
    transparent
  );
  border-radius: 2px;
  filter: blur(2px);
  opacity: 0;
  transition: all 200ms var(--ease-out);
}

.diff-block:hover {
  transform: scale(1.01);
  box-shadow: var(--shadow-md);
}

.diff-block:hover::before {
  opacity: 1;
  transform: translateY(-50%) scaleY(1);
}
```

#### 7.2.6 版本快照生成动效

```css
/* 成功确认动画 */
@keyframes checkmarkDraw {
  from {
    stroke-dashoffset: 100;
  }
  to {
    stroke-dashoffset: 0;
  }
}

.version-created-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-elevated);
  border: 1px solid var(--success);
  border-radius: var(--radius-xl);
  padding: 16px 24px;
  box-shadow: var(--shadow-xl);
  animation: slideInFromBottom 300ms var(--ease-out);
}

@keyframes slideInFromBottom {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.checkmark-icon {
  width: 28px;
  height: 28px;
}

.checkmark-icon path {
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: checkmarkDraw 400ms var(--ease-out) 200ms forwards;
}
```

#### 7.2.7 加载状态动效

```css
/* 流式打字光标 */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--brand-orange-500);
  margin-left: 2px;
  animation: blink 1s infinite;
}

/* 骨架屏闪烁 */
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--bg-elevated) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-md);
}

/* 旋转加载器 */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-default);
  border-top-color: var(--brand-orange-500);
  border-radius: 50%;
  animation: spin 600ms linear infinite;
}
```

#### 7.2.8 橙色光晕脉冲（品牌特色动效）

```css
/* 活跃状态指示 - 模仿 Logo 光晕 */
@keyframes glowPulse {
  0%, 100% {
    box-shadow: 0 0 20px rgba(249,115,22,0.3),
                0 0 40px rgba(249,115,22,0.15);
  }
  50% {
    box-shadow: 0 0 30px rgba(249,115,22,0.5),
                0 0 60px rgba(249,115,22,0.25);
  }
}

.active-indicator {
  position: relative;
}

.active-indicator::after {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  background: radial-gradient(circle, rgba(249,115,22,0.2), transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
  z-index: -1;
}

/* 应用场景：AI 正在生成、测试运行中、版本正在保存 */
.generating {
  animation: glowPulse 2s ease-in-out infinite;
}
```

#### 7.2.9 微交互：成功/错误状态

```css
/* 接受变更成功 */
@keyframes successShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

.diff-block--accepted {
  animation: successShake 300ms var(--ease-out);
}

/* 拒绝变更摇头 */
@keyframes rejectShake {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}

.diff-block--rejected {
  animation: rejectShake 200ms var(--ease-out);
}
```

#### 7.2.10 页面切换转场

```css
/* 编辑器 ↔ 对比视图切换 */
@keyframes fadeSlideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.view-transition {
  animation: fadeSlideIn 300ms var(--ease-out);
}

/* 分屏滑入 */
.split-view__left {
  animation: slideInFromLeft 300ms var(--ease-out);
}

.split-view__right {
  animation: slideInFromRight 300ms var(--ease-out);
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### 7.3 无障碍动效控制

```css
/* 尊重用户偏好 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  
  .tooltip-bubble,
  .glass-panel,
  .diff-block {
    transition: opacity 100ms !important;
    transform: none !important;
  }
}
```

---

## 8. 响应式设计 (Responsive Design)

### 8.1 断点系统

```css
--breakpoint-sm: 640px;   /* 小屏幕 */
--breakpoint-md: 768px;   /* 平板 */
--breakpoint-lg: 1024px;  /* 笔记本 */
--breakpoint-xl: 1280px;  /* 桌面 */
--breakpoint-2xl: 1536px; /* 大桌面 */
```

### 8.2 布局适配策略

| 屏幕尺寸 | 布局调整 |
|---------|---------|
| < 768px | Sidebar 默认折叠，Chat Panel 改为底部抽屉 |
| 768px - 1024px | Sidebar 可折叠，Chat Panel 最小宽 320px |
| 1024px - 1280px | 标准三栏布局，Chat Panel 默认 380px |
| > 1280px | Chat Panel 默认 420px，可扩至 640px |

### 8.3 响应式断点示例

```css
/* 小屏幕 - 单栏布局 */
@media (max-width: 767px) {
  .workspace-layout {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    height: auto;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .chat-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 60vh;
    transform: translateY(100%);
    transition: transform 300ms;
  }
  
  .chat-panel--open {
    transform: translateY(0);
  }
}

/* 中等屏幕 - 两栏布局 */
@media (min-width: 768px) and (max-width: 1023px) {
  .sidebar {
    width: 64px; /* 仅图标 */
  }
  
  .chat-panel {
    min-width: 280px;
    max-width: 400px;
  }
}

/* 大屏幕 - 完整三栏 */
@media (min-width: 1024px) {
  .workspace-layout {
    display: grid;
    grid-template-columns: 280px 1fr 420px;
    gap: 0;
  }
}
```


---

## 9. 图标系统 (Iconography)

### 9.1 图标库选择

**主图标库**：Lucide Icons（轻量、现代、一致性强）

**备选**：Heroicons（Tailwind 官方）

**原则**：
- 统一使用 SVG 格式
- 统一尺寸：24×24 viewBox
- 统一描边粗细：1.5px
- 禁止使用 emoji 作为功能图标（仅可用于装饰性内容）

### 9.2 核心图标映射

| 功能 | 图标 | Lucide 名称 |
|------|------|-------------|
| 文件/文档 | 📄 | `file-text` |
| 编辑 | ✏️ | `pencil` |
| 保存 | 💾 | `save` |
| 对比 | ⚖️ | `git-compare` |
| 版本历史 | ⏱ | `history` |
| AI 对话 | 💬 | `message-square` |
| 接受修改 | ✓ | `check` |
| 拒绝修改 | ✗ | `x` |
| 设置 | ⚙️ | `settings` |
| 搜索 | 🔍 | `search` |
| 新增 | + | `plus` |
| 删除 | 🗑 | `trash-2` |
| 下载/导出 | ⬇️ | `download` |
| 上传/导入 | ⬆️ | `upload` |
| 展开/折叠 | ▶️/▼ | `chevron-right` / `chevron-down` |
| 更多操作 | ⋯ | `more-horizontal` |
| 警告 | ⚠️ | `alert-triangle` |
| 成功 | ✓ | `check-circle` |
| 错误 | ✗ | `x-circle` |
| 信息 | ℹ️ | `info` |
| 锁定 | 🔒 | `lock` |
| 刷新 | 🔄 | `refresh-cw` |
| 复制 | 📋 | `copy` |
| 链接 | 🔗 | `link` |
| 标签 | 🏷️ | `tag` |

### 9.3 图标使用规范

```css
.icon {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 1.5px;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon--sm { width: 16px; height: 16px; }
.icon--md { width: 20px; height: 20px; }
.icon--lg { width: 24px; height: 24px; }
.icon--xl { width: 32px; height: 32px; }

/* 图标按钮 */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  transition: all 150ms;
}

.icon-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```

---

## 10. 特定场景 UI 设计

### 10.1 空状态设计 (Empty States)

```html
<!-- 无文档状态 -->
<div class="empty-state">
  <div class="empty-state__icon">
    <svg><!-- file-plus icon --></svg>
  </div>
  <h3 class="empty-state__title">开始你的第一个 Prompt</h3>
  <p class="empty-state__description">
    创建新文档或导入现有的 Prompt/Skill 文件
  </p>
  <div class="empty-state__actions">
    <button class="btn-primary">
      <svg><!-- plus icon --></svg>
      新建 Prompt
    </button>
    <button class="btn-secondary">
      <svg><!-- upload icon --></svg>
      导入 SKILL.md
    </button>
  </div>
</div>
```

```css
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-16);
  text-align: center;
  min-height: 400px;
}

.empty-state__icon {
  width: 80px;
  height: 80px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-6);
  color: var(--text-muted);
}

.empty-state__icon svg {
  width: 40px;
  height: 40px;
}

.empty-state__title {
  font-size: var(--text-2xl);
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: var(--space-3);
}

.empty-state__description {
  color: var(--text-secondary);
  max-width: 400px;
  margin-bottom: var(--space-6);
}

.empty-state__actions {
  display: flex;
  gap: var(--space-3);
}
```

### 10.2 引用确认条 (Reference Confirmation Bar)

```html
<!-- 工作区文件引用 -->
<div class="reference-bar">
  <div class="reference-bar__label">
    <svg><!-- link icon --></svg>
    将关联 3 个文件
  </div>
  <div class="reference-bar__tags">
    <div class="file-tag file-tag--confirmed">
      <svg><!-- check icon --></svg>
      scripts/postprocess.py
      <button class="file-tag__remove">×</button>
    </div>
    <div class="file-tag file-tag--pending">
      <svg><!-- help-circle icon --></svg>
      references/fields.md (疑似)
      <button class="file-tag__preview">👁</button>
    </div>
    <div class="file-tag">
      <svg><!-- file icon --></svg>
      config.json
      <button class="file-tag__remove">×</button>
    </div>
  </div>
  <div class="reference-bar__meta">
    预估 ~2.4k tokens
  </div>
</div>
```

```css
.reference-bar {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-4);
}

.reference-bar__label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.reference-bar__tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  flex: 1;
}

.file-tag__remove,
.file-tag__preview {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 150ms;
}

.file-tag__remove:hover {
  background: var(--error);
  color: white;
}

.file-tag__preview:hover {
  background: var(--info);
  color: white;
}
```

### 10.3 错误面板 (Error Panel)

```html
<!-- 规则校验错误 -->
<div class="error-panel">
  <div class="error-panel__header">
    <h4>发现 3 处规则冲突</h4>
    <button class="btn-icon">
      <svg><!-- x icon --></svg>
    </button>
  </div>
  <div class="error-panel__list">
    <div class="error-item error-item--error" data-line="5">
      <div class="error-item__icon">
        <svg><!-- alert-circle icon --></svg>
      </div>
      <div class="error-item__content">
        <div class="error-item__title">缺少必填字段：name</div>
        <div class="error-item__location">第 5 行</div>
      </div>
      <button class="error-item__jump">跳转</button>
    </div>
    <div class="error-item error-item--warning" data-line="23">
      <div class="error-item__icon">
        <svg><!-- alert-triangle icon --></svg>
      </div>
      <div class="error-item__content">
        <div class="error-item__title">模块顺序不符：instructions 应在 examples 之前</div>
        <div class="error-item__location">第 23 行</div>
      </div>
      <button class="error-item__jump">跳转</button>
    </div>
  </div>
  <div class="error-panel__footer">
    <button class="btn-secondary btn-secondary--sm">
      <svg><!-- wand icon --></svg>
      自动修复
    </button>
  </div>
</div>
```

```css
.error-panel {
  position: absolute;
  right: var(--space-4);
  top: var(--topbar-height) + var(--space-4);
  width: 360px;
  max-height: 500px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  z-index: 50;
}

.error-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-4);
  border-bottom: 1px solid var(--border-subtle);
}

.error-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-2);
}

.error-item {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 150ms;
}

.error-item:hover {
  background: var(--bg-tertiary);
}

.error-item__icon {
  flex-shrink: 0;
}

.error-item--error .error-item__icon {
  color: var(--error);
}

.error-item--warning .error-item__icon {
  color: var(--warning);
}

.error-item__content {
  flex: 1;
}

.error-item__title {
  font-size: 13px;
  color: var(--text-primary);
  margin-bottom: var(--space-1);
}

.error-item__location {
  font-size: 12px;
  color: var(--text-muted);
}

.error-item__jump {
  background: none;
  border: 1px solid var(--border-default);
  color: var(--text-secondary);
  padding: 4px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  cursor: pointer;
  transition: all 150ms;
}

.error-item__jump:hover {
  border-color: var(--brand-orange-500);
  color: var(--brand-orange-500);
}
```

### 10.4 Toast 通知 (Toast Notifications)

```css
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  z-index: 9999;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-xl);
  min-width: 320px;
  max-width: 480px;
  animation: slideInFromBottom 300ms var(--ease-out);
}

.toast--success {
  border-color: var(--success);
}

.toast--error {
  border-color: var(--error);
}

.toast--warning {
  border-color: var(--warning);
}

.toast__icon {
  flex-shrink: 0;
}

.toast--success .toast__icon {
  color: var(--success);
}

.toast--error .toast__icon {
  color: var(--error);
}

.toast__content {
  flex: 1;
}

.toast__title {
  font-weight: 500;
  margin-bottom: var(--space-1);
}

.toast__message {
  font-size: 13px;
  color: var(--text-secondary);
}

.toast__close {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: all 150ms;
}

.toast__close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}
```


---

## 11. 品牌应用规范 (Logo & Brand Usage)

### 11.1 Logo 使用规则

- **最小尺寸**：导航栏 32×32px，图标场景不小于 24×24px
- **安全边距**：Logo 周围保留至少等同于 Logo 高度 25% 的空白
- **背景要求**：深色背景使用原始 Logo；浅色背景需验证橙色光晕对比度，必要时使用纯色版本
- **禁止操作**：不拉伸变形、不旋转、不改变橙蓝配色比例、不添加额外阴影效果

### 11.2 Logo 光晕在界面中的延伸应用

Logo 的橙色光晕效果延伸至整个界面的"活跃/智能"状态指示语言：

| 场景 | 应用方式 |
|------|---------|
| AI 正在生成回复 | 头像周围 `glowPulse` 动效 |
| 主 CTA 按钮 hover | `shadow-glow-orange` 阴影 |
| 版本节点（当前版本） | 圆点边框橙色 + 光晕 |
| 测试运行中 | 进度指示器橙色脈动 |
| 品牌强调色使用原则 | 全局仅 1-2 处同时出现光晕，避免视觉噪音 |

### 11.3 顶栏 Logo 组合规范

```html
<div class="brand-lockup">
  <img src="/logo.svg" alt="PromptStudio" class="brand-lockup__icon" />
  <span class="brand-lockup__name">PromptStudio</span>
</div>
```

```css
.brand-lockup {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-2);
}

.brand-lockup__icon {
  width: 32px;
  height: 32px;
}

.brand-lockup__name {
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}
```

---

## 12. 可访问性规范 (Accessibility)

### 12.1 核心要求

| 类别 | 要求 |
|------|------|
| 色彩对比度 | 正文文本 ≥ 4.5:1；大标题 ≥ 3:1（WCAG AA） |
| 键盘导航 | 所有交互元素可通过 Tab 访问，Enter/Space 激活 |
| 焦点指示 | 可见焦点环 `outline: 2px solid var(--border-focus)` |
| ARIA 标签 | 图标按钮必须有 `aria-label`；状态变化用 `aria-live` |
| 动效控制 | 尊重 `prefers-reduced-motion` |
| 色彩独立性 | Diff 类型不能仅靠颜色区分，需配合图标/文字标签 |

### 12.2 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `N` / `P` | 下一处 / 上一处变更块 |
| `Enter` | 打开当前变更块详情 |
| `A` | 接受当前变更块 |
| `R` | 拒绝当前变更块 |
| `Esc` | 收起修改日志 Tab |
| `Ctrl/Cmd + K` | 全局命令面板（P2） |
| `Ctrl/Cmd + S` | 保存文档 |
| `Ctrl/Cmd + Enter` | 发送消息 |

### 12.3 焦点样式

```css
*:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

/* 输入框焦点特殊处理（避免双重边框） */
.input-field:focus-visible {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px rgba(79,70,229,0.15);
}
```

---

## 13. 技术实现建议 (Implementation Notes)

### 13.1 CSS 架构

推荐采用 **CSS 变量 + Tailwind CSS** 组合方案：

```js
// tailwind.config.js 关键扩展
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          orange: {
            400: '#FB923C',
            500: '#F97316',
            600: '#EA580C',
            900: '#C2410C',
          },
          indigo: {
            400: '#818CF8',
            600: '#4F46E5',
            800: '#3730A3',
          }
        },
        diff: {
          added: '#16A34A',
          removed: '#DC2626',
          replaced: '#2563EB',
          reordered: '#D97706',
        }
      },
      backdropBlur: {
        panel: '16px',
      },
      transitionTimingFunction: {
        'ease-out-custom': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      boxShadow: {
        'glow-orange': '0 0 24px rgba(249,115,22,0.4), 0 0 48px rgba(249,115,22,0.2)',
        'glow-indigo': '0 0 24px rgba(79,70,229,0.3), 0 0 48px rgba(79,70,229,0.15)',
      }
    }
  }
}
```

### 13.2 动效实现建议

- **简单过渡**：纯 CSS transition/animation（按钮、hover、Tab 滑入）
- **复杂交互动效**：推荐引入 **Framer Motion**（React 场景）实现气泡防抖逻辑、Diff 块级联动画
- **编辑器**：CodeMirror 6 + 自定义装饰器实现行内波浪线、diff 高亮
- **虚拟滚动**：长文档场景使用 `react-window` 或 CodeMirror 内置虚拟化避免卡顿

### 13.3 性能预算

| 指标 | 目标 |
|------|------|
| 首屏渲染 (FCP) | < 1.5s |
| 交互动效帧率 | 稳定 60fps（避免 layout thrashing，优先 transform/opacity） |
| Diff 计算渲染 | < 500ms（2000 行文档） |
| Tab 滑入动画 | 使用 `transform` 而非 `right/left` 属性变化 |

---

## 14. 设计交付检查清单 (Pre-Delivery Checklist)

### 视觉质量
- [ ] 无 emoji 作为功能图标（仅 Lucide/Heroicons SVG）
- [ ] 品牌橙色光晕仅用于强调状态，避免全局滥用
- [ ] 深色/浅色主题下文字对比度均达标（4.5:1+）
- [ ] Diff 四种类型颜色 + 图标双重标识（色盲友好）

### 交互动效
- [ ] 所有可点击元素具备 `cursor: pointer`
- [ ] 悬停反馈不引起布局抖动（用 transform 而非改变尺寸）
- [ ] 气泡防抖：150ms 延迟出现 / 400ms 延迟消失
- [ ] 毛玻璃 Tab：260ms `cubic-bezier(0.16,1,0.3,1)` 滑入滑出
- [ ] 所有动效尊重 `prefers-reduced-motion`

### 布局适配
- [ ] 375px / 768px / 1024px / 1440px 断点验证
- [ ] Sidebar 折叠态与展开态过渡流畅
- [ ] Chat Panel 拖拽调整边界正确（320-640px）
- [ ] 无横向滚动（移动端）

### 可访问性
- [ ] 所有图标按钮有 `aria-label`
- [ ] Tab 键遍历顺序符合视觉顺序
- [ ] 焦点样式清晰可见
- [ ] 表单输入有关联 label

---

## 15. 附录：设计资产清单

### 15.1 需要产出的设计文件

| 类型 | 文件 | 用途 |
|------|------|------|
| 设计令牌 | `design-tokens.css` | CSS 变量定义（已在项目 `css/` 目录） |
| 图标集 | `icons/` | SVG sprite 或独立文件 |
| 字体文件 | Google Fonts / 本地字体包 | Inter, JetBrains Mono |
| Logo 资源 | `logo.svg`, `logo-icon.svg`, `logo-white.svg` | 多主题适配 |
| 组件库文档 | Storybook（可选） | 组件可视化维护 |

### 15.2 关键页面清单（待实现）

1. 首启引导页（Onboarding）
2. 主工作台（编辑器 + 对话面板）
3. Diff 对比视图（全屏模式）
4. 修改日志 Tab（毛玻璃面板）
5. 版本时间线页面
6. 规则集管理页面
7. 模型接入设置页面（四步向导）
8. 测试沙箱页面（P1）
9. 设置总览页面

---

*本设计方案基于 PromptStudio PRD v1.1 与项目 Logo 视觉基因综合制定，遵循 ui-ux-pro-max 设计系统方法论。所有色值、间距、动效参数均可直接转化为 CSS 变量与 Tailwind 配置落地实现。*

