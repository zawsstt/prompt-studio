# -*- coding: utf-8 -*-
"""生成 PromptStudio Demo 成果说明 PDF（HTML -> Chrome print-to-pdf）"""
import base64, pathlib, datetime

ROOT = pathlib.Path(r"D:/pp studio")
SHOTS = ROOT / "docs" / "demo-shots"
OUT_HTML = ROOT / "submission" / "PromptStudio-Demo成果说明.html"
OUT_HTML.parent.mkdir(parents=True, exist_ok=True)


def img(name):
    p = SHOTS / name
    if not p.exists():
        return ""
    b = base64.b64encode(p.read_bytes()).decode()
    return f"data:image/png;base64,{b}"


CSS = """
@page { size: A4 landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body { font-family:"Microsoft YaHei","PingFang SC","Noto Sans CJK SC",sans-serif; color:#101014; background:#fff; }
.slide { width:297mm; height:210mm; padding:14mm 16mm 12mm; position:relative; page-break-after:always; overflow:hidden; display:flex; flex-direction:column; }
.slide:last-child { page-break-after:auto; }
.brand { display:flex; align-items:center; gap:8px; font-size:10px; color:#6B7280; letter-spacing:.5px; }
.mark { width:18px; height:18px; border-radius:5px; background:#6366F1; color:#fff; font-weight:700; font-size:11px; display:flex; align-items:center; justify-content:center; }
.pageno { position:absolute; right:16mm; top:14mm; font-size:10px; color:#9CA3AF; }
h1 { font-size:40px; line-height:1.2; letter-spacing:-.5px; }
h2 { font-size:22px; margin-bottom:4px; }
h3 { font-size:14px; }
.sub { color:#6B7280; font-size:12px; line-height:1.7; }
.rule { height:3px; width:44px; background:#6366F1; border-radius:2px; margin:10px 0 14px; }
.grid { display:grid; gap:10px; }
.card { border:1px solid #E8E8EF; border-radius:10px; padding:11px 12px; background:#FCFCFE; }
.card b { font-size:12.5px; display:block; margin-bottom:4px; }
.card p { font-size:10.5px; color:#5B5B6B; line-height:1.6; }
.tag { display:inline-block; font-size:9.5px; padding:2px 7px; border-radius:99px; background:#EEF0FF; color:#4F46E5; margin-right:5px; }
.shot { width:100%; border:1px solid #E5E7EB; border-radius:8px; display:block; }
.cap { margin-top:9px; background:#0F1020; color:#E8E9F5; border-radius:9px; padding:9px 13px; display:flex; gap:11px; align-items:flex-start; }
.cap .who { font-size:9.5px; color:#A5B4FC; letter-spacing:.6px; white-space:nowrap; padding-top:2px; }
.cap .txt { font-size:10.5px; line-height:1.65; }
.cap .txt em { color:#C7D2FE; font-style:normal; font-weight:600; }
.foot { position:absolute; left:16mm; bottom:8mm; font-size:9px; color:#B0B0BC; }
.link { font-family:Consolas,monospace; font-size:11px; color:#4338CA; }
.kv { display:grid; grid-template-columns:34mm 1fr; gap:6px 10px; font-size:11px; }
.kv div:nth-child(odd) { color:#6B7280; }
.flow { display:flex; align-items:stretch; gap:7px; }
.step { flex:1; border:1px solid #E8E8EF; border-radius:9px; padding:10px; background:#fff; position:relative; }
.step .n { font-size:9px; color:#6366F1; font-weight:700; letter-spacing:1px; }
.step b { display:block; font-size:12px; margin:3px 0 4px; }
.step p { font-size:9.5px; color:#5B5B6B; line-height:1.55; }
.arrow { align-self:center; color:#C7C9D9; font-size:14px; }
.two { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
"""


def cap(ts, text):
    return f'<div class="cap"><div class="who">🎙 字幕解说<br>{ts}</div><div class="txt">{text}</div></div>'


def head(no, title):
    return f'''<div class="brand"><span class="mark">P</span> PromptStudio · Demo 成果说明</div>
<div class="pageno">{no:02d}</div>'''


def slide(no, body, foot="PromptStudio — 集成式 Prompt / Skill 编辑、多模型对话与可视化修改对比"):
    return f'<section class="slide">{head(no, "")}{body}<div class="foot">{foot}</div></section>'


today = "2026-10-22"

# ── 01 封面 ──
s1 = f'''<section class="slide" style="justify-content:center; background:linear-gradient(135deg,#FFFFFF 0%,#F6F5FF 55%,#EEF0FF 100%);">
<div class="brand"><span class="mark">P</span> PromptStudio · Demo 成果说明</div>
<div style="margin-top:26mm;">
  <div style="font-size:11px; color:#6366F1; letter-spacing:3px; font-weight:700;">KIRO DEMO SUBMISSION</div>
  <h1 style="margin-top:8px;">PromptStudio<br><span style="color:#6366F1;">提示词工作台</span></h1>
  <p class="sub" style="margin-top:12px; font-size:13px; max-width:150mm;">集成式 Prompt / Skill 编辑、多模型对话与可视化修改对比应用<br>让每一次 AI 改写都可对比、可解释、可回滚</p>
</div>
<div style="margin-top:16mm; display:flex; gap:26px;">
  <div class="kv" style="flex:1;">
    <div>在线体验</div><div class="link">https://zawsstt.github.io/prompt-studio/</div>
    <div>开源仓库</div><div class="link">https://github.com/zawsstt/prompt-studio</div>
    <div>提交日期</div><div>{today}</div>
  </div>
  <div style="flex:1; border-left:1px solid #DDDDF0; padding-left:22px;">
    <div style="font-size:10px; color:#6B7280; letter-spacing:1px; margin-bottom:7px;">核心能力</div>
    <div style="font-size:11.5px; line-height:2; color:#2B2B3A;">规则引擎实时校验 · 多模型流式对话<br>四色 Diff 对比 · Why/How/Effect 修改日志<br>版本时间线回滚 · 8 家模型一键接入</div>
  </div>
</div>
<div class="foot">本文件为 Demo 成果说明，全部界面截图取自线上运行版本，每页附字幕解说</div>
</section>'''

# ── 02 产品定位 ──
s2 = slide(2, f'''
<h2>要解决的问题：AI 改 Prompt，改了什么、为什么改、能不能退？</h2>
<div class="rule"></div>
<p class="sub" style="max-width:230mm;">今天大多数人调 Prompt 的方式是「复制到对话框 → 让模型改写 → 整段覆盖粘贴回来」。这个过程有三个硬伤：<b>看不见改了什么</b>（整段覆盖，无从核对）、<b>不知道为什么改</b>（只有结果没有理由）、<b>退不回去</b>（历史版本靠手工另存）。PromptStudio 把「AI 改写」从一次黑盒替换，变成一个可审阅、可逐块决策、可回滚的工程流程。</p>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr; margin-top:12mm;">
  <div class="card"><b>① 改了什么？</b><p>左右分屏 Diff，行级 LCS + 字符级细化，四色标记新增 / 删除 / 替换 / 重排，支持逐块跳转。</p></div>
  <div class="card"><b>② 为什么改？</b><p>每处变更绑定 Why / How / Effect 三段说明，说明可编辑，把 AI 产物变成用户资产。</p></div>
  <div class="card"><b>③ 能不能退？</b><p>每次接受修改自动生成版本快照，时间线可视化，一键回滚且不覆盖历史。</p></div>
</div>
<div class="grid" style="grid-template-columns:1fr 1fr; margin-top:8mm;">
  <div class="card" style="background:#F7F8FF; border-color:#DDDDFB;"><b>产品定位</b><p>面向 Prompt 工程师 / Agent 开发者的「带信任机制的修改引擎」：编辑、校验、对话、对比、留痕、回滚，在一个工作台里闭环。</p></div>
  <div class="card" style="background:#F7F8FF; border-color:#DDDDFB;"><b>形态</b><p>纯前端 Web 应用，零后端依赖；模型 API Key 只存本机（系统凭据库 / 本地加密），浏览器直连厂商端点，无中间代理。</p></div>
</div>
''')

# ── 03 功能全景 ──
s3 = slide(3, f'''
<h2>六大核心模块</h2>
<div class="rule"></div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr; gap:11px;">
  <div class="card"><b>1 · 编辑器 + 规则引擎</b><p>Markdown / YAML frontmatter 编辑，CodeMirror 6 高亮；编辑防抖 500ms 实时校验，行内波浪线 + 右侧问题面板双通道；一键「自动整理」按规则集重排模块。</p></div>
  <div class="card"><b>2 · 多模型对话</b><p>8 家供应商流式对话，Reasoning 折叠展示；自动注入当前文档、规则集摘要与迭代摘要；全文 / 增量两种上下文模式。</p></div>
  <div class="card"><b>3 · Diff 对比视图</b><p>左右分屏同步滚动，四色变更标记，字符级差异细化；变更摘要面板 + 悬停气泡；键盘 N/P 跳转、A 接受、R 拒绝。</p></div>
  <div class="card"><b>4 · 修改日志</b><p>毛玻璃滑入面板，逐块展示 Why / How / Effect、行号范围、片段对照与模型元信息；说明可编辑、可钉住。</p></div>
  <div class="card"><b>5 · 版本时间线</b><p>接受修改自动快照，v1→v2→v3 时间线；回滚生成新版本不覆盖历史；可导出变更日志与 SKILL.md。</p></div>
  <div class="card"><b>6 · 模型接入</b><p>四步接入：选供应商 → 选模型 → 填 Key → 测连接；内置 8 家模板，支持自定义 OpenAI 兼容端点（内网网关）。</p></div>
</div>
<div class="grid" style="grid-template-columns:1fr 1fr; margin-top:9px;">
  <div class="card"><b>规则集：三类校验</b><p><span class="tag">结构</span>必含/禁止字段、模块顺序　<span class="tag">格式</span>YAML 合法性、代码块语言标签、标题层级、行宽　<span class="tag">风格</span>人称统一、祈使句、禁用模糊词</p></div>
  <div class="card"><b>工作区范围：三层隔离</b><p><span class="tag">范围</span>按 ## 标题自动解析模块　<span class="tag">勾选</span>只把选定模块送进上下文　<span class="tag">锁定</span>锁定模块只读，防止 AI 越界改动</p></div>
</div>
''')

# ── 04 使用流程 ──
s4 = slide(4, f'''
<h2>使用流程：从导入文档到定稿留痕</h2>
<div class="rule"></div>
<div class="flow">
  <div class="step"><div class="n">STEP 01</div><b>导入 / 新建</b><p>拖入 .md 文件或整个文件夹，自动解析 frontmatter 与 ## 模块。</p></div>
  <div class="arrow">→</div>
  <div class="step"><div class="n">STEP 02</div><b>选规则集</b><p>Anthropic Skill 标准 / 通用 Prompt / OpenAI Function / 自定义。</p></div>
  <div class="arrow">→</div>
  <div class="step"><div class="n">STEP 03</div><b>实时校验</b><p>结构 / 格式 / 风格三类规则即时报错，点击定位到行。</p></div>
  <div class="arrow">→</div>
  <div class="step"><div class="n">STEP 04</div><b>对话改写</b><p>选模型，写清修改意图，流式拿到候选文档。</p></div>
  <div class="arrow">→</div>
  <div class="step"><div class="n">STEP 05</div><b>逐块审阅</b><p>Diff 对比 + 修改日志，逐条接受/拒绝，全部处理完生成新版本。</p></div>
</div>
<div class="grid" style="grid-template-columns:1fr 1fr 1fr; margin-top:13mm;">
  <div class="card"><b>上下文可控</b><p>全文模式发送整篇 + 规则集 + 迭代摘要；增量模式只发送选中区块，节省 40%+ token。</p></div>
  <div class="card"><b>决策可逆</b><p>每处变更独立决策，接受/拒绝实时反映到行内状态；退出前提醒未处理项。</p></div>
  <div class="card"><b>结果可带走</b><p>定稿后可导出 SKILL.md 与 Markdown 变更日志，直接进代码仓库。</p></div>
</div>
''')

# ── 05 主界面 ──
s5 = slide(5, f'''
<h2>界面演示 1 · 三栏工作台：编辑、校验、对话同屏</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<img class="shot" src="{img('B-main.png')}" style="height:118mm; object-fit:cover; object-position:top;">
{cap("00:05 – 00:35", "左栏是 <em>CodeMirror 编辑器</em>，打开的是 <em>code-review-agent.md</em>；右侧实时校验面板报出 1 处格式错误——第 26 行的代码块缺少语言标签，问题可直接点击定位。中间顶部的下拉是<em>规则集切换</em>，当前使用「Anthropic Skill 标准」。右栏是 <em>AI 对话面板</em>，本轮把用户的三点要求整理成三条改动说明，Reasoning 区块折叠保留模型的思考过程；底部「应用为候选修改」是把回复转成候选文档的唯一入口——<em>AI 永远不能直接改文档</em>。")}
''')

# ── 06 Diff ──
s6 = slide(6, f'''
<h2>界面演示 2 · Diff 对比：四色标记，逐块决策</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<img class="shot" src="{img('C-diff.png')}" style="height:118mm; object-fit:cover; object-position:top;">
{cap("00:36 – 01:10", "点击「应用为候选修改」后进入对比视图：左侧修改前、右侧候选修改，<em>滚动完全同步</em>。本页共 <em>3 处修改</em>：绿色是新增的 Constraints 章节，黄色是替换（第 3 条指令改为祈使句），红色是删除（重复的 Examples 段），蓝色表示重排。顶部工具条给出统计 <em>+6 / −4 / −152 tokens</em>，并可一键接受全部或拒绝全部；「忽略格式/空行」「忽略重排」两个开关让对比只看内容变化。")}
''')

# ── 07 修改日志 ──
s7 = slide(7, f'''
<h2>界面演示 3 · 修改日志：每处改动都有 Why / How / Effect</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<img class="shot" src="{img('D-modlog.png')}" style="height:118mm; object-fit:cover; object-position:top;">
{cap("01:11 – 01:45", "点击任一变更块，右侧滑出<em>毛玻璃修改日志面板</em>。它把这一处修改拆成三段：<em>Why</em> 为什么改（触发了哪条规则）、<em>How</em> 怎么改（具体手法）、<em>Effect</em> 改完有什么效果（对指令遵循率、token 成本的影响）。下方还记录行号范围、模型名、token 与成本估算。说明文本<em>用户可以自己改写</em>——这样修改日志就不只是 AI 的产物，而是团队的评审记录。")}
''')

# ── 08 版本 ──
s8 = slide(8, f'''
<h2>界面演示 4 · 版本时间线：每一步都可回溯</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<img class="shot" src="{img('E-history.png')}" style="height:118mm; object-fit:cover; object-position:top;">
{cap("01:46 – 02:10", "所有变更处理完毕后生成新版本快照，在「历史」里以<em>时间线</em>呈现：每个节点标注版本号、备注、时间与变更统计。回滚不会覆盖历史，而是<em>以旧版本内容生成一个新版本</em>，所以任何一次「反悔」本身也被记录。每个版本都可以导出<em>变更日志</em>（Markdown）和 <em>SKILL.md</em>，直接进仓库或交给团队复用。")}
''')

# ── 09 规则集 + 工作区 ──
s9 = slide(9, f'''
<h2>界面演示 5 · 规则集与工作区范围：把规范变成可执行的检查</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<div class="two">
  <div><img class="shot" src="{img('F-ruleset.png')}" style="height:96mm; object-fit:cover; object-position:top;"></div>
  <div><img class="shot" src="{img('G-workspace.png')}" style="height:96mm; object-fit:cover; object-position:top;"></div>
</div>
{cap("02:11 – 02:40", "左图是<em>规则集管理</em>：结构、排序、格式、风格四类规则可逐条查看和调整，也可以把团队现成的规范 .md <em>导入并提炼成规则集</em>。右图是<em>工作区范围</em>：按 ## 标题自动解析出模块，勾选哪些模块参与 AI 上下文、哪些<em>锁定为只读</em>，让 AI 只在授权区域内改动。")}
''')

# ── 10 模型接入 ──
s10 = slide(10, f'''
<h2>界面演示 6 · 模型接入：四步接入，Key 不出本机</h2>
<div class="rule" style="margin:8px 0 10px;"></div>
<img class="shot" src="{img('H-settings.png')}" style="height:118mm; object-fit:cover; object-position:top;">
{cap("02:41 – 03:05", "接入流程只有四步：<em>选供应商 → 选/填模型名 → 粘贴 API Key → 测试连接</em>。内置 OpenAI、DeepSeek、Anthropic、Gemini、通义千问、Moonshot、Ollama、OpenRouter 八家模板，也可自定义 OpenAI 兼容端点接公司内网网关。API Key <em>只存本机</em>（系统凭据库优先，其次本地 AES-256-GCM 加密），输入后不可回显，浏览器直连厂商端点，<em>没有任何中间代理</em>。")}
''')

# ── 11 技术实现 ──
s11 = slide(11, f'''
<h2>技术实现方式</h2>
<div class="rule"></div>
<div class="two" style="grid-template-columns:1.15fr 1fr;">
  <div>
    <div class="kv" style="grid-template-columns:30mm 1fr; font-size:11px; line-height:1.9;">
      <div>前端框架</div><div>TypeScript + React 18，Vite 构建，纯静态产物部署 GitHub Pages</div>
      <div>编辑器</div><div>CodeMirror 6（markdown / yaml 语法高亮、行号、选区捕获）</div>
      <div>状态管理</div><div>Zustand 单一 Store，集中管理文档、对话、Diff、版本四类状态</div>
      <div>Diff 引擎</div><div>自研行级 LCS 算法 + diff-match-patch 字符级细化，输出结构化 ChangeBlock[]</div>
      <div>规则引擎</div><div>结构 / 排序 / 格式 / 风格四类规则声明式配置，逐行扫描产出带行号的 issue 列表</div>
      <div>流式对话</div><div>原生 fetch + ReadableStream 解析 SSE，AbortController 支持随时中断</div>
      <div>本地持久化</div><div>IndexedDB（Dexie）存文档 / 对话 / 版本，localStorage 存设置</div>
      <div>密钥安全</div><div>系统凭据库（Windows Credential Manager / macOS Keychain）优先，回退本地 AES-256-GCM</div>
    </div>
  </div>
  <div class="card" style="background:#F7F8FF; border-color:#DDDDFB;">
    <b>三个关键设计决策</b>
    <p style="margin-bottom:9px;"><span class="tag">1</span> <b>AI 只产出候选，不直接落盘</b>：模型回复必须经「应用为候选修改」转成候选文档，再由用户在 Diff 中逐块接受，才写回正文。</p>
    <p style="margin-bottom:9px;"><span class="tag">2</span> <b>变更块是唯一数据单位</b>：Diff 的 ChangeBlock 同时承载变更内容、说明、接受状态与模型元信息，修改日志、版本快照、变更日志导出全部复用它。</p>
    <p><span class="tag">3</span> <b>零后端</b>：没有服务端存储与代理，密钥与文档都不离开浏览器，部署成本为零，也避免了「把 Prompt 传给第三方」的信任问题。</p>
  </div>
</div>
''')

# ── 12 Kiro 能力 ──
s12 = slide(12, f'''
<h2>使用了哪些 Kiro 能力</h2>
<div class="rule"></div>
<div class="grid" style="grid-template-columns:1fr 1fr; gap:11px;">
  <div class="card"><b>① Spec 驱动开发</b><p>先用 Kiro 的 Spec 模式把想法写成需求 → 设计 → 任务三件套（对应仓库里的 PRD、design-proposal、模块功能说明），再让 Agent 按任务清单逐条实现，避免一次性生成一大坨不可维护的代码。</p></div>
  <div class="card"><b>② Agentic 多文件编码</b><p>编辑器、Diff、修改日志、版本、设置等模块由 Agent 跨文件生成与重构，包括 Store action、组件与样式联动改动，人工只做验收与关键决策。</p></div>
  <div class="card"><b>③ Steering 规范约束</b><p>把设计规范（色板、动效时长、缓动曲线、组件约定）写进 steering 文件，让后续每次生成都自动遵守同一套设计语言，不用反复在对话里重复交代。</p></div>
  <div class="card"><b>④ Hooks 自动校验</b><p>配置保存/构建时自动跑类型检查与脚本验证，把「改完就跑一遍」固化成钩子，减少回归问题。</p></div>
  <div class="card"><b>⑤ 终端与浏览器预览闭环</b><p>在 Kiro 内直接起 Vite 开发服务器、跑 Puppeteer 截图脚本核对界面，形成「改代码 → 看真实页面 → 再改」的快速迭代回路。</p></div>
  <div class="card"><b>⑥ 上下文引用与对话式调试</b><p>用 #File / #Folder 把相关源码、设计稿、报错信息拉进上下文，让 Agent 定位跨模块问题（如 Diff 与修改日志的绑定关系）。</p></div>
</div>
''')

# ── 13 资源与链接 ──
s13 = slide(13, f'''
<h2>资源清单与复现方式</h2>
<div class="rule"></div>
<div class="two" style="grid-template-columns:1fr 1fr;">
  <div>
    <div class="card" style="margin-bottom:9px;"><b>在线链接</b>
      <p style="line-height:2;">Demo 体验：<span class="link">https://zawsstt.github.io/prompt-studio/</span><br>
      开源仓库：<span class="link">https://github.com/zawsstt/prompt-studio</span><br>
      GitHub Pages 自动部署（push main 触发）</p>
    </div>
    <div class="card"><b>本地文件下载路径</b>
      <p style="line-height:2;">项目根目录：<span class="link">D:\\pp studio</span><br>
      本说明文档：<span class="link">D:\\pp studio\\submission\\PromptStudio-Demo成果说明.pdf</span><br>
      界面截图：<span class="link">D:\\pp studio\\docs\\demo-shots\\</span><br>
      需求与设计：<span class="link">PRD-PromptStudio-集成式Prompt编辑应用.md</span><br>
      模块说明：<span class="link">PromptStudio-模块功能说明.md</span></p>
    </div>
  </div>
  <div class="card" style="background:#F7F8FF; border-color:#DDDDFB;">
    <b>本地运行（30 秒）</b>
    <p style="font-family:Consolas,monospace; font-size:10.5px; line-height:2; color:#2B2B3A;">
    cd "D:\\pp studio"<br>
    npm install<br>
    npm run dev &nbsp;&nbsp;<span style="color:#6B7280;"># http://localhost:3000</span><br>
    npm run build &nbsp;<span style="color:#6B7280;"># 产出 dist/，任意静态服务器可托管</span></p>
    <p style="margin-top:10px; font-size:10.5px; color:#5B5B6B; line-height:1.7;">
    <b>体验建议路线（约 3 分钟）</b><br>
    ① 打开线上链接 → 跳过引导 → 点「打开主文档」<br>
    ② 看右侧实时校验报错，点问题跳转定位<br>
    ③ 在对话面板输入修改要求（未配置 Key 时先到设置里接一家模型）<br>
    ④ 点「应用为候选修改」→ 在 Diff 中逐块接受/拒绝<br>
    ⑤ 打开修改日志看 Why/How/Effect → 处理完毕生成新版本 → 到「历史」回滚试试</p>
  </div>
</div>
''')

html = f'''<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>PromptStudio Demo 成果说明</title><style>{CSS}</style></head>
<body>{s1}{s2}{s3}{s4}{s5}{s6}{s7}{s8}{s9}{s10}{s11}{s12}{s13}</body></html>'''

OUT_HTML.write_text(html, encoding="utf-8")
print("HTML:", OUT_HTML, len(html) // 1024, "KB")
