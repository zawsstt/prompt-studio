// src/lib/sanitize.ts
var BUILTIN_RULES = [
  {
    id: "sql-table",
    label: "SQL \u5E95\u8868\u540D\uFF08ods_/dwd_/dws_/ads_/dim_/tmp_/stg_ \u524D\u7F00\uFF09",
    shortLabel: "SQL \u5E95\u8868\u540D",
    source: "\\b(?:ods|dwd|dws|ads|dim|tmp|stg)_[a-zA-Z0-9_]{2,}\\b"
  },
  {
    id: "phone",
    label: "\u624B\u673A\u53F7\uFF081 \u5F00\u5934 11 \u4F4D\uFF09",
    shortLabel: "\u624B\u673A\u53F7",
    source: "1[3-9]\\d{9}"
  },
  {
    id: "idcard",
    label: "\u8EAB\u4EFD\u8BC1\u53F7\uFF0818 \u4F4D\uFF09",
    shortLabel: "\u8EAB\u4EFD\u8BC1\u53F7",
    source: "\\b\\d{17}[\\dXx]\\b"
  },
  {
    id: "email",
    label: "\u90AE\u7BB1\u5730\u5740",
    shortLabel: "\u90AE\u7BB1",
    source: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
  },
  {
    id: "ip-internal",
    label: "\u5185\u7F51 IP\uFF0810./172.16-31./192.168.\uFF09",
    shortLabel: "\u5185\u7F51 IP",
    source: "\\b(?:10\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.|192\\.168\\.)[0-9]{1,3}\\.[0-9]{1,3}\\b"
  }
];
var MASK_PREFIX = "{{";
var MASK_SUFFIX = "}}";
var UNMASK_RE = /\{\{SENS-(\d{3,})\}\}|SENS-(\d{3,})/g;
function parseSensitiveTermLines(lines) {
  const map = /* @__PURE__ */ new Map();
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const sep = line.search(/[|｜]/);
    const value = (sep >= 0 ? line.slice(0, sep) : line).trim();
    const label = sep >= 0 ? line.slice(sep + 1).trim() : "";
    if (!value) continue;
    map.set(value, label || map.get(value) || "");
  }
  return [...map.entries()].map(([value, label]) => ({ value, label }));
}
function inferSensitiveLabel(token) {
  for (const rule of BUILTIN_RULES) {
    try {
      if (new RegExp(`^(?:${rule.source})$`).test(token)) return rule.shortLabel;
    } catch {
    }
  }
  return "";
}
function collectSensitiveTokens(texts, terms, rules) {
  const found = /* @__PURE__ */ new Set();
  for (const text2 of texts) {
    for (const term of terms) {
      if (!term.trim()) continue;
      if (text2.includes(term)) found.add(term);
    }
    for (const rule of rules) {
      let re;
      try {
        re = new RegExp(rule.source, "g");
      } catch {
        continue;
      }
      let m;
      while ((m = re.exec(text2)) !== null) {
        found.add(m[0]);
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  }
  return found;
}
function buildMaskRegistry(tokens2, labelOf) {
  const sorted = [...tokens2].sort((a, b) => b.length - a.length);
  const byId = /* @__PURE__ */ new Map();
  const byToken = /* @__PURE__ */ new Map();
  const labelById = /* @__PURE__ */ new Map();
  sorted.forEach((token, i) => {
    const id = `SENS-${String(i + 1).padStart(3, "0")}`;
    byId.set(id, token);
    byToken.set(token, id);
    labelById.set(id, labelOf?.(token) || inferSensitiveLabel(token) || "\u81EA\u5B9A\u4E49\u654F\u611F\u8BCD");
  });
  return { byId, byToken, labelById };
}
function maskText(text2, registry) {
  let out = text2;
  const tokens2 = [...registry.byToken.keys()].sort((a, b) => b.length - a.length);
  for (const token of tokens2) {
    const id = registry.byToken.get(token);
    out = out.split(token).join(MASK_PREFIX + id + MASK_SUFFIX);
  }
  return out;
}
function unmaskText(text2, registry) {
  return text2.replace(UNMASK_RE, (_all, a, b) => {
    const id = "SENS-" + (a ?? b);
    const original = registry.byId.get(id);
    return original ?? _all;
  });
}
function extractMaskIds(text2) {
  const ids = [];
  let m;
  const re = /\{\{SENS-(\d{3,})\}\}|SENS-(\d{3,})/g;
  while ((m = re.exec(text2)) !== null) {
    ids.push("SENS-" + (m[1] ?? m[2]));
  }
  return ids;
}
function buildMaskLegend(registry, texts) {
  const used = /* @__PURE__ */ new Set();
  for (const text2 of texts) {
    for (const id of extractMaskIds(text2)) used.add(id);
  }
  if (used.size === 0) return null;
  const ids = [...used].sort((a, b) => Number(a.slice(5)) - Number(b.slice(5)));
  const mapping = ids.map(
    (id) => `- {{${id}}} \u2014 \u542B\u4E49 / type: ${registry.labelById.get(id) || "\u81EA\u5B9A\u4E49\u654F\u611F\u8BCD"}`
  );
  return [
    "## \u8131\u654F\u7F16\u7801\u672C / Redaction codebook",
    "\u4E0B\u9762\u51FA\u73B0\u7684\u7F16\u53F7\u662F\u672C\u5730\u8131\u654F\u5360\u4F4D\u7B26\uFF0C\u53EA\u4EE3\u8868\u5B9E\u4F53\u7C7B\u578B\uFF0C\u4E0D\u5305\u542B\u771F\u5B9E\u503C\u3002",
    "\u8BF7\u4FDD\u7559\u7F16\u53F7\u539F\u6837\uFF08\u5305\u542B {{ }}\uFF09\uFF0C\u4E0D\u8981\u731C\u6D4B\u3001\u8865\u5168\u6216\u6539\u5199\u771F\u5B9E\u5185\u5BB9\uFF1B\u5F15\u7528\u65F6\u4F7F\u7528\u7F16\u53F7\u672C\u8EAB\uFF0C\u4E0D\u8981\u7528\u542B\u4E49\u6807\u7B7E\u4EE3\u66FF\u7F16\u53F7\u3002\u4E0D\u8981\u590D\u8FF0\u672C\u7F16\u7801\u672C\u3002",
    "The codes below are local pseudonyms. Keep each code exactly as written (including braces); never guess or reconstruct the real value. When referring to the entity, use the code itself, not the type label. Do not repeat this codebook.",
    ...mapping
  ].join("\n");
}

// tests/sanitize.entry.ts
var pass = 0;
var fail = 0;
var ok = (name, cond, extra = "") => {
  if (cond) {
    pass++;
    console.log("  \u2713", name);
  } else {
    fail++;
    console.log("  \u2717", name, extra);
  }
};
console.log("\n[1] \u81EA\u5B9A\u4E49\u8BCD\u6761\u89E3\u6790");
var entries = parseSensitiveTermLines([
  "\u8BE6\u7EC6\u6307\u6807A | \u4E1A\u52A1\u6307\u6807",
  "ods_user_info_daily\uFF5C\u6570\u636E\u8868\u540D",
  "\u5F20\u67D0\u67D0 | \u5BA2\u6237\u59D3\u540D",
  "\u624B\u673A\u53F7\u6761\u76EE",
  "",
  "\u8BE6\u7EC6\u6307\u6807A | \u4E1A\u52A1\u6307\u6807\uFF08\u8986\u76D6\uFF09",
  "   "
]);
ok("\u7A7A\u884C\u88AB\u5FFD\u7565\u3001\u91CD\u590D\u8BCD\u6761\u5408\u5E76", entries.length === 4, `got ${entries.length}`);
ok("\u534A\u89D2 | \u89E3\u6790\u51FA\u542B\u4E49\u6807\u8BB0", entries.find((e) => e.value === "\u8BE6\u7EC6\u6307\u6807A")?.label === "\u4E1A\u52A1\u6307\u6807\uFF08\u8986\u76D6\uFF09");
ok("\u5168\u89D2 \uFF5C \u89E3\u6790\u51FA\u542B\u4E49\u6807\u8BB0", entries.find((e) => e.value === "ods_user_info_daily")?.label === "\u6570\u636E\u8868\u540D");
ok("\u6CA1\u6709\u6807\u8BB0\u65F6 label \u4E3A\u7A7A", entries.find((e) => e.value === "\u624B\u673A\u53F7\u6761\u76EE")?.label === "");
ok(
  "\u89E3\u6790\u7ED3\u679C\u53EA\u4FDD\u7559\u771F\u5B9E\u8BCD\u6761\uFF08\u4E0D\u542B\u6807\u8BB0\uFF09",
  entries.every((e) => !e.value.includes("|") && !e.value.includes("\uFF5C"))
);
console.log("\n[2] \u7C7B\u578B\u6807\u8BB0\u4E0E\u7F16\u53F7");
var custom = [
  { value: "\u8BE6\u7EC6\u6307\u6807A", label: "\u4E1A\u52A1\u6307\u6807" },
  { value: "ods_user_info_daily", label: "" },
  { value: "\u5F20\u67D0\u67D0", label: "\u5BA2\u6237\u59D3\u540D" }
];
var text = [
  "ods_user_info_daily \u662F\u5E95\u8868\uFF0C\u8BE6\u7EC6\u6307\u6807A \u9700\u8981\u4F18\u5316\u3002",
  "\u5BA2\u6237\u5F20\u67D0\u67D0\uFF0C\u624B\u673A 13800138000\uFF0C\u90AE\u7BB1 a@b.com\uFF0C\u5185\u7F51 192.168.1.10\u3002"
].join("\n");
var labels = new Map(custom.map((e) => [e.value, e.label]));
var tokens = collectSensitiveTokens([text], custom.map((e) => e.value), BUILTIN_RULES);
var reg = buildMaskRegistry(tokens, (t) => labels.get(t) || "");
var idOf = (v) => reg.byToken.get(v);
ok("\u81EA\u5B9A\u4E49\u8BCD\u6761\u88AB\u6536\u96C6", !!idOf("\u8BE6\u7EC6\u6307\u6807A") && !!idOf("\u5F20\u67D0\u67D0"));
ok("SQL \u5E95\u8868\u81EA\u52A8\u8BC6\u522B\u7C7B\u578B", !!idOf("ods_user_info_daily") && reg.labelById.get(idOf("ods_user_info_daily")) === "SQL \u5E95\u8868\u540D");
ok("\u81EA\u5B9A\u4E49\u6807\u8BB0\u4F18\u5148", reg.labelById.get(idOf("\u5F20\u67D0\u67D0")) === "\u5BA2\u6237\u59D3\u540D");
ok("\u5185\u7F6E\u624B\u673A\u53F7\u81EA\u52A8\u8BC6\u522B", !!idOf("13800138000") && reg.labelById.get(idOf("13800138000")) === "\u624B\u673A\u53F7");
ok("\u5185\u7F6E\u90AE\u7BB1\u81EA\u52A8\u8BC6\u522B", !!idOf("a@b.com") && reg.labelById.get(idOf("a@b.com")) === "\u90AE\u7BB1");
ok("\u5185\u7F6E\u5185\u7F51 IP \u81EA\u52A8\u8BC6\u522B", !!idOf("192.168.1.10") && reg.labelById.get(idOf("192.168.1.10")) === "\u5185\u7F51 IP");
ok("\u672A\u77E5\u81EA\u5B9A\u4E49\u8BCD\u6761\u56DE\u9000", buildMaskRegistry(/* @__PURE__ */ new Set(["\u4E00\u4E9B\u4E1A\u52A1\u8BCD"])).labelById.get("SENS-001") === "\u81EA\u5B9A\u4E49\u654F\u611F\u8BCD");
ok("inferSensitiveLabel \u5BF9\u975E\u5185\u7F6E\u8BCD\u6761\u8FD4\u56DE\u7A7A", inferSensitiveLabel("\u4E00\u4E9B\u4E1A\u52A1\u8BCD") === "");
console.log("\n[3] \u8131\u654F / \u8FD8\u539F");
var masked = maskText(text, reg);
ok("\u5168\u90E8\u547D\u4E2D\u66FF\u6362\u4E3A {{SENS-xxx}}", (masked.match(/\{\{SENS-\d{3,}\}\}/g) || []).length >= 6);
ok(
  "\u8131\u654F\u6587\u672C\u4E0D\u5305\u542B\u4EFB\u4F55\u539F\u6587",
  !masked.includes("ods_user_info_daily") && !masked.includes("\u8BE6\u7EC6\u6307\u6807A") && !masked.includes("\u5F20\u67D0\u67D0") && !masked.includes("13800138000") && !masked.includes("a@b.com") && !masked.includes("192.168.1.10"),
  masked
);
ok("unmaskText \u7CBE\u786E\u8FD8\u539F", unmaskText(masked, reg) === text);
ok("\u517C\u5BB9 AI \u53BB\u6389\u53CC\u5927\u62EC\u53F7\u7684\u7F16\u53F7", unmaskText(masked.replace(/\{\{|\}\}/g, ""), reg) === text);
console.log("\n[4] \u7F16\u7801\u672C");
var legend = buildMaskLegend(reg, [masked]);
ok("\u751F\u6210\u7F16\u7801\u672C", !!legend);
ok(
  "\u7F16\u7801\u672C\u5305\u542B\u7C7B\u578B\u6807\u8BB0",
  !!legend && legend.includes("SQL \u5E95\u8868\u540D") && legend.includes("\u4E1A\u52A1\u6307\u6807") && legend.includes("\u5BA2\u6237\u59D3\u540D") && legend.includes("\u624B\u673A\u53F7") && legend.includes("\u90AE\u7BB1") && legend.includes("\u5185\u7F51 IP")
);
ok(
  "\u7F16\u7801\u672C\u53EA\u5305\u542B\u7F16\u53F7\uFF0C\u4E0D\u6CC4\u9732\u539F\u6587",
  !!legend && !legend.includes("ods_user_info_daily") && !legend.includes("\u8BE6\u7EC6\u6307\u6807A") && !legend.includes("\u5F20\u67D0\u67D0") && !legend.includes("13800138000") && !legend.includes("a@b.com") && !legend.includes("192.168.1.10")
);
ok(
  "\u7F16\u7801\u672C\u8981\u6C42\u4FDD\u7559\u5360\u4F4D\u7B26",
  !!legend && legend.includes("\u4E0D\u8981\u731C\u6D4B") && legend.includes("including braces")
);
var reg2 = buildMaskRegistry(/* @__PURE__ */ new Set(["\u53EA\u51FA\u73B0\u8BCD", "\u672A\u51FA\u73B0\u8BCD"]));
var masked2 = maskText("\u53EA\u51FA\u73B0\u8BCD", reg2);
var legend2 = buildMaskLegend(reg2, [masked2]);
ok(
  "\u7F16\u7801\u672C\u53EA\u5217\u672C\u6B21\u5B9E\u9645\u7528\u5230\u7684\u7F16\u53F7",
  !!legend2 && (legend2.match(/- \{\{SENS-\d{3,}\}\}/g) || []).length === 1,
  legend2 ?? "null"
);
ok("\u6CA1\u6709\u7F16\u53F7\u65F6\u8FD4\u56DE null", buildMaskLegend(reg, ["\u666E\u901A\u6587\u672C"]) === null);
console.log(`
${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
