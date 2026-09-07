# NANFU 官网设计语言提炼总结（Design Language Distill）

> 日期：2026-08-05 ｜ 分析对象：https://www.nanfu.global（南孚集团全球官网）
> 方法：HTML + CSS 源码级逆向（`docs/nanfu-index.html` / `docs/nanfu-index.css` 存档），taste-skill 三表盘校准
> 用途：作为 PromptStudio 官网 V3（T06c）的设计转译输入

---

## 0. 一句话定位

> **「把品牌自信全部押在排版上，其余一切从简。」**
> 大字、大字、大字 —— 单色渐变烧穿 —— 横向行进的文字 —— 深色电影段落 —— 滚动仪式细节。
> 是「印刷感 × 电影感」的混合体：像杂志封面，也像预告片。

---

## 1. 核心机制拆解（源码证据）

### 1.1 视口驱动的巨型字号系统（Typography-as-hero）
```css
html { font-size: 5.20833vw }   /* 1920px 视口 → 根字号 100px */
.f-300 { letter-spacing: -.03em; font-size: 3rem }  /* = 300px @1920 */
.f-120 { letter-spacing: -.03em; font-size: 1.2rem } /* = 120px @1920 */
```
- 字号阶梯：f-60 / f-90 / f-120 / f-140 / f-300（hero h1 60px、历史年份 90px、产品标题 120px、计数 140-300px）
- **所有大字统一 `letter-spacing:-.03em`**（负字距压紧，巨型字的气场来源）
- 三段字重制造节奏：`word_b`(bold) / `word_r`(regular) / `word_l`(weight:100 超细)

### 1.2 品牌色烧穿渐变文字（Signature Gradient）
```css
.txt-color { background: linear-gradient(150deg, #e61721 45%, #fff 100%);
             -webkit-background-clip: text; -webkit-text-fill-color: transparent }
.mc { color: #e60008 }   /* 南孚红，仅此一色 */
```
- 品牌色 = 单一红色 `#e60008`；展示字体 = 红→白 150° 烧穿渐变
- **一个颜色 + 一条渐变 = 全部品牌资产**，其余全部黑白灰

### 1.3 逐字母横向扫入（Letter March）
```css
.letter { opacity: 0; transform-origin: 0;
          transition: opacity .8s, transform 1.2s cubic-bezier(.38,0,0,1) }
.letter:nth-child(1) { transform: translate(20px) }
.letter:nth-child(2) { transform: translate(30px) }
… 每字母横向位移 +10px 递增（最高 150px）
```
- 文字不是淡入，是**从右向左横向行进**；位移逐字母递增产生波浪
- 曲线 `cubic-bezier(.38,0,0,1)`（近线性、几乎无回弹）——行进感而非弹跳感

### 1.4 暗色电影段落（Cinematic Dark Interlude）
```css
background: linear-gradient(#000 0%, #1a1a1a 100%)   /* 深色段落 */
background: linear-gradient(#1a1a1a 0%, #000 50%)    /* 过渡 */
```
- 页面对半明暗：白底段（banner/r1）+ 黑底段（r2 产品/r3 技术/r5 历史）
- 深色段内：白字 `wc` + 红色点缀 `mc` + 视频/大图背景 + 巨型字号
- **明暗切换 = 叙事节奏**（taste-skill §4.11 允许的「一次主题对比」）

### 1.5 滚动叙事与仪式细节（Scroll Rituals）
| 细节 | 证据 | 作用 |
|---|---|---|
| 多屏滚动 | `data-vh="2.3" / "3.5"`（banner 300vh） | 慢节奏电影叙事 |
| 滚动指示器 | 「scroll to explore」+ mouse 图标动画 | 引导首屏之外 |
| 虚线连接线 | SVG `stroke-dasharray="1.5,4.5"` 标签→产品图 | 标注关系的印刷感 |
| 帧动画 canvas | bannerCv(120帧) / batteryCv(150帧) 粒子 | 品牌级细节动效 |
| 计数动画 | `<em class="count">345</em>` rAF 计数 | 数字会说话 |
| 浮动圆形按钮 | `.fixBox` 固定右下「Leave A Message」 | 常驻转化触点 |
| 全屏菜单 | SVG shape overlay 变形动画 | 移动端仪式感 |
| swiper 视差 tab | 3×100vh 整屏标签页 | 大块内容的翻页感 |

---

## 2. 转译矩阵（NANFU → PromptStudio，T06c）

| NANFU 手法 | 转译 | 理由 |
|---|---|---|
| 南孚红 `#e60008` | 保留品牌靛蓝 `#6366F1` | 品牌色不可挪用 |
| 红→白 150° 烧穿渐变 | `#4F46E5→#6366F1→#A8B1FA` 150°（浅色段）/ `#6366F1→#fff`（深色段） | 同机制、同角度，换色相 |
| f-300 巨型计数 | 指标数字放大至 clamp(48px,6vw,120px) | 数字即证据 |
| f-120 大标题 | section h2 → clamp(40px,5.6vw,88px) | 标题即宣言 |
| 逐字母横向扫入 | `.ltr` 全站 h1/h2/公式 chip | 招牌动效，8-24px 克制版漂移 |
| 暗色电影段落 | 「信任公式」整段深色化（`#0B0B12` 工作台 Canonical 色） | 品牌规范 §2.1：深色才是产品 Canonical；一次主题对比 |
| scroll to explore | hero 底部鼠标指示器 | 仪式感 |
| 浮动圆形按钮 | 右下「免费使用」渐变圆钮 | 常驻转化 |
| 虚线连接线 | trust 区 diff 行 → 玻璃面板的 SVG 虚线 | 标注关系 |
| 深色 footer | footer 改 `#0B0B12` + 大 logo | 收尾的仪式感 |

**克制项**：不引入 300vh 长滚动、不做 canvas 帧动画、不做 swiper 整屏 tab（单页营销页篇幅有限，避免形式大于内容 —— taste-skill「MOTION MUST BE MOTIVATED」）。

### 2.1 T06d 增补 · 滚动联动（Scroll Driver）

| 联动 | 实现 | 验证 |
|---|---|---|
| 统一 ScrollDriver | 单 rAF 节流滚动循环，驱动进度条/视差/倾斜/章节指示 | ✅ 4 配置 0 缺失 |
| 前后景视差 | `[data-speed]`：hero 标题 -0.06 / mockup 0.04 / section 标题 0.03 / diff 窗口 0.05，各自速度漂移 | ✅ 标题 -40→-405px 随滚动漂移 |
| hero 窗口滚动倾斜 | 滚出首屏时 rotate 0→-13.5° + 上浮（电影感后仰） | ✅ |
| 导航章节指示 | 南孚 nav `.on` 同款：当前章节靛蓝光点 | ✅ loop→trust-panel→providers→versions 顺序点亮 |
| scroll 指示器 | 位于首屏折线（100vh-118px），滚 40px 即隐 | ✅ |
| IO 可靠性修复 | 阈值全面下调（reveal .06 / ltr .1 / bento .15）+ 1.5s 视口内强制补发 `.in` + reduced-motion 不再早退 | ✅ 1600×900 与 1366×768 × 两种动效模式，缺失=NONE |

---

## 3. 校准后的三表盘（T06c）

| 表盘 | T06b | T06c | 理由 |
|---|---|---|---|
| DESIGN_VARIANCE | 8 | 9 | 巨型排版 + 明暗段落打破模板感 |
| MOTION_INTENSITY | 7 | 7 | letter march + 计数已是上限，不表演 |
| VISUAL_DENSITY | 4 | 3 | 大字必须配大留白 |

*落地验证见 `scripts/verify-t06c-landing.mjs`，截图 `docs/t06c-*.png`。*

---

## 8. T06d 增补 · 动态绑定联动修复（工作台）

> 自检发现的「展示层与数据源错绑」类问题——打开导入文件后，面包屑/错误横幅/AI 上下文/Diff 统计仍固定指向主文档。全链路修复并验证。

| 绑定点 | 修复前 | 修复后 |
|---|---|---|
| TopBar 面包屑 | 固定 docName（主文档） | 跟随 editingFilePath → 显示文件名 |
| TopBar 错误横幅 | 固定主文档 validationIssues | 文件模式读 fileValidationIssues，横幅随文件错误显隐 |
| buildContextMessages（AI 上下文） | 固定注入 docContent | 文件模式注入当前文件内容（标注文件名） |
| applyAsCandidate（候选应用） | 一律写入主文档 candidateContent | 文件模式写回 importedFiles + 记录快照 → diff 对比 → 接受后落盘文件 |
| DiffView token 估算 | 固定读 candidateContent | 跟随 diffQueue[currentDiffFileIdx].right |
| setRuleset | 只重跑主文档校验 | 文件模式同步重跑文件校验 |
| TopBar 对比入口守卫 | !candidateContent 硬拦截 | 动态判断 diff 是否真正打开（候选或文件修改任一） |

**自检**（scripts/verify-t06d-binding.mjs，mock SSE + 真实 UI 全链路）：导入测试文件 → 打开 → 面包屑/横幅/行数跟随 ✅ → 发送消息（AI 上下文=文件）✅ → 应用候选 → 文件 diff（+2/−3，~44 tokens）✅ → 接受全部 → 文件内容落盘为 AI 修改版 ✅ → 0 页面错误。回归 fixture：scripts/t06d-fixture.md。

### 8.1 T06e 增补 · 首次引导数据隔离（?first=1）

> 官网入口进入时历史数据（版本/对话/工作区/导入文件/主文档）不得露面；同时本会话新操作不得污染真实数据。

| 方案 | 实现 |
|---|---|
| init 内拦截（单一事实源） | init 开头读 `?first=1` → 跳过主文档/版本/对话/工作区/导入文件的全部历史恢复；showOnboarding/showWelcome 直置 true。规避了 StrictMode 双 init 下「App 侧重置 vs init 异步恢复」的竞态（实测曾出现版本清空但导入残留） |
| 独立 docId 隔离写入 | 演示模式切 `docId: 'doc-demo-firstrun'`，会话内导入/建版本落演示文档，真实数据零触碰；刷新（无参）恢复正常 docId 恢复 |
| URL 参数即清 | history.replaceState 清参，刷新走正常恢复 |

**自检**（scripts/verify-firstrun-final.mjs，预置数据 → first=1 → 刷新三态）：老用户导入 1 文件后，first=1 工作区 fileRows=0/scopes=0/空态 ✅；无参刷新后 fileRows=1「已导入文件 (1)」完整恢复 ✅。

---

## 9. T07/T08 增补 · 安全与本地化能力（线上发布准备）

### 9.1 敏感数据脱敏管线（T07）

> 用户思路验证：可行，且正是行业标准做法。AI 全程只见编号，确认窗口还原原文。

| 环节 | 实现 |
|---|---|
| 引擎 `src/lib/sanitize.ts` | 内置规则（SQL 底表 ods_/dwd_/dws_/ads_/dim_ 前缀、手机号、身份证、邮箱、内网 IP）+ 用户词库精确匹配 |
| 全局一致编号 | 扫描全部文档 → 按长度降序统一编号（SENS-001…）→ 多文档引用同步改写，同一 token 永远同编号 |
| 占位格式 | `{{SENS-001}}`（还原兼容裸 SENS-001；未知编号原样保留防 AI 幻觉） |
| 集成点 | `buildContextMessages`（AI 上下文含文档/引用/工作区/用户输入全部脱敏）；`applyAsCandidate` 提取后按映射表还原；本地气泡保留原文展示 |
| 映射表 | 会话级驻留（永不发送）；设置页可查看编号数量 |
| UI | 设置页「⑤ 敏感数据脱敏」：总开关 + 词条管理（每行一条）+ 内置规则说明 |

验证：单元 11/11（一致性/还原/裸编号/幻觉/长词优先/内置规则）+ 全链路（mock SSE 捕获 payload：文档块与用户输入块零原文、5 编号齐全；编辑器还原零编号残留）。

### 9.2 本地授权文件夹（T08，线上发布场景）

> 内容永不"上传"：授权目录即本地文件资源管理器，读取/编辑/写回全部在本机。

| 环节 | 实现 |
|---|---|
| API | File System Access API（Chrome/Edge，https/localhost）`showDirectoryPicker({mode:'readwrite'})` |
| 句柄持久化 | Dexie v3 `localFolders` 表（原生句柄可结构化克隆）；打开网页自动恢复 + 权限探测（need-auth 时 UI 引导「重新授权」） |
| 文件树 | 递归列出授权目录（过滤 node_modules/.git 等 + 仅文本类扩展名） |
| 读写 | `readLocalFile` / `createWritable` 写回；编辑击键、diff 接受、AI 候选应用三处写回挂接 |
| 数据边界 | `local://` 前缀文件内容**不落库**（本地文件即持久化）；pick 时句柄持久化失败自动降级为会话级授权 |
| UI | 工作区「本地文件夹」区块：授权/重新授权/刷新 + 文件树（根文件 + 可展开文件夹） |

验证（mock File System Access API 全链路）：授权→树→打开（面包屑/编辑器内容正确）→键盘编辑逐击键写回本地 → 0 页面错误；真实浏览器原生句柄持久化恢复路径已实现（headless 无法模拟原生句柄克隆）。

---

## 10. T09 增补 · 发版前清理（Release Prep）

> 根因修复：全新用户/演示模式的主文档预置了业务示例（驾驶舱主agent/财经数据）——观感等同「历史使用信息」。

| 项 | 修复 |
|---|---|
| 全新用户首文档 | `SAMPLE_DOC` 从业务示例改为**空白引导模板**（frontmatter 占位 + 结构引导注释），`docName` 改 `untitled-prompt.md`；有历史用户不受影响（init 从 IndexedDB 恢复） |
| first=1 演示模式 | 同模板（与全新用户一致，无任何业务观感） |
| 重置全部数据 | 设置页「重置全部数据」按钮 + `?reset=1` URL 入口（先清参数防 reload 循环）：清空 IndexedDB 全部表 + localStorage（promptstudio:* / ps_*）→ 回到全新首次使用 |
| 残留扫描 | src 硬编码业务数据 0 残留（docName/示例文档已清）；Ollama localhost 模板为产品默认值保留 |

验证（scripts/verify-t09-release.mjs）：全新用户主文档=模板（无驾驶舱/财经字样）✅；first=1 同 ✅；?reset=1 清空后重建默认模板文档并回到引导 ✅。发版前可用 `?reset=1` 一键清空浏览器内全部历史数据。
