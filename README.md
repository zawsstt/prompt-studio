# PromptStudio — 提示词工作台

集成式 Prompt / Skill 编辑、多模型对话与可视化修改对比应用。

## 项目结构

```
DIFF_prompt/
├── index.html                      # 入口 HTML（DOM 骨架）
├── README.md                       # 本文件
├── css/                            # 样式表（11 个文件）
│   ├── design-tokens.css           # CSS 变量系统（色板/间距/动效/字体）
│   ├── reset.css                   # CSS Reset + 基础样式
│   ├── layout.css                  # 全局布局（导航列 + 顶栏 + 主内容 + 对话面板）
│   ├── components.css              # 可复用组件（按钮/输入框/下拉/徽标/标签）
│   ├── editor.css                  # 编辑器区域样式
│   ├── chat.css                    # 对话面板 + 消息气泡 + Reasoning 区块
│   ├── diff.css                    # 对比视图（分屏/变更行/悬停气泡）
│   ├── mod-log.css                 # 修改日志 Tab（玻璃拟态滑入面板）
│   ├── settings.css                # 设置模态框
│   └── animations.css              # Motion.Lab 动效 keyframes + 工具类
├── js/                             # JavaScript 模块（12 个文件，ES Modules）
│   ├── app.js                      # 应用入口：初始化、路由、全局事件绑定
│   ├── store.js                    # 状态管理（类 Zustand 的轻量 Observable Store）
│   ├── events.js                   # 事件总线（PubSub 模式，跨组件通信）
│   ├── utils.js                    # 工具函数（DOM、escape、toast、confetti）
│   ├── data.js                     # 示例数据、校验规则、供应商模板、初始状态
│   ├── icons.js                    # 内联 SVG 图标库
│   ├── editor.js                   # 编辑器模块（内容管理、防抖输入）
│   ├── validation.js               # 规则引擎（实时校验 + 面板渲染）
│   ├── chat.js                     # 对话模块（消息发送、流式模拟、Reasoning）
│   ├── model-selector.js           # 模型选择器（富下拉菜单）
│   ├── diff.js                     # Diff 引擎 + 对比视图渲染（Myers 算法）
│   ├── mod-log.js                  # 修改日志面板（Why/How/Effect + 接受/拒绝）
│   ├── version.js                  # 版本管理（时间线、回滚、AI 摘要）
│   └── settings.js                 # 设置模块（供应商管理、连接测试）
└── assets/                         # 静态资源（图片、字体等）
```

## 快速开始

### 方式 1：本地 HTTP 服务器（推荐）

使用任意 HTTP 服务器托管项目根目录：

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code Live Server 插件
# 右键 index.html → "Open with Live Server"
```

然后浏览器访问 `http://localhost:8080`

### 方式 2：直接打开（部分功能受限）

双击 `index.html` 在浏览器中打开。注意：ES Modules 在 `file://` 协议下可能被浏览器的 CORS 策略阻止。建议使用方式 1。

### 部署到服务器

将整个 `DIFF_prompt/` 目录上传到任意静态文件服务器即可：

```bash
# Nginx
server {
    root /var/www/promptstudio;
    index index.html;
}

# Vercel / Netlify
# 直接部署项目根目录，无需构建步骤
```

## 技术栈

- **纯前端**：HTML + CSS + JavaScript (ES Modules)
- **零依赖**：无 npm 包，无构建工具
- **状态管理**：自研 Observable Store（类 Zustand 模式）
- **事件通信**：自研 Event Bus（PubSub 模式）
- **CSS 架构**：Design Tokens → Reset → Layout → Components → Features
- **动效库**：集成 Motion.Lab 160 个精选动效的关键帧

## 浏览器兼容性

| Chrome | Edge | Firefox | Safari |
|--------|------|---------|--------|
| 88+    | 88+  | 78+     | 14+    |

需要 ES Modules (`<script type="module">`) 和 CSS `backdrop-filter` 支持。

## 核心功能

1. **编辑器 + 规则引擎**：Markdown/YAML 编辑、实时校验（结构/格式/风格规则）、一键自动整理
2. **多模型对话**：流式输出、Reasoning 折叠区块、@ 文件引用、应用为候选修改
3. **Diff 对比视图**：左右分屏同步滚动、四色变更类型（新增/删除/替换/重排）
4. **修改日志 Tab**：玻璃拟态滑入面板、Why/How/Effect 修改说明、逐块接受/拒绝
5. **版本管理**：版本时间线、回滚、AI 迭代摘要（两级披露）
6. **模型接入**：三步傻瓜式接入、供应商模板、连接测试

## 设计规范

- 深色主题（`#0B0B12` 底色）
- Indigo `#6366F1` 品牌色
- 等宽字体：JetBrains Mono / Cascadia Code
- 动效 ≤ 260ms，`cubic-bezier(0.16, 1, 0.3, 1)` 缓出曲线
- 响应式断点：768px / 1024px

---

*Built with PromptStudio — 带信任机制的修改引擎*
