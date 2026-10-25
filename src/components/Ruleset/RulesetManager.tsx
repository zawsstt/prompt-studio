import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { RULESETS } from '../../data/rulesets';
import type { RuleSet } from '../../types';
import { X, Upload, Plus, Pencil, Trash2, Copy, ChevronDown, ChevronRight, ListTree, Check, AlertTriangle } from 'lucide-react';
import TourButton from '../shared/TourButton';
import { useAutoTour } from '../../hooks/useTour';

/** 规则配置的可读中文描述 */
function ruleLine(rs: RuleSet, kind: 'structure' | 'order' | 'format' | 'style', i: number): string {
  try {
    if (kind === 'structure') {
      const r = rs.structureRules[i];
      const typeMap: Record<string, string> = {
        'require-frontmatter': `必须包含 frontmatter 字段 [${(r.fields ?? []).join(', ')}]`,
        'require-module': `必须包含模块「${r.module}」`,
        'forbid-module': `禁止模块「${r.module}」`,
        'forbid-field': `禁止字段 [${(r.fields ?? []).join(', ')}]`,
        'unknown-module': '未知模块检查',
      };
      return `${typeMap[r.type] ?? r.type} — ${r.error}`;
    }
    if (kind === 'order') {
      const r = rs.orderRules[i];
      return `「${r.module}」位于第 ${r.position} 位${r.optional ? '（可选）' : ''}`;
    }
    if (kind === 'format') {
      const r = rs.formatRules[i];
      const typeMap: Record<string, string> = {
        'codeblock-language': '代码块必须标注语言',
        'heading-depth': `标题层级 ≤ ${r.max}`,
        'line-width': `行宽 ≤ ${r.max}${r.warning ? '（警告）' : ''}`,
        'yaml-frontmatter': 'YAML frontmatter 校验',
      };
      return `${typeMap[r.type] ?? r.type}${r.enforce ? '（强制）' : ''}`;
    }
    const r = rs.styleRules[i];
    const typeMap: Record<string, string> = {
      'person-consistency': `人称呼应统一为「${r.person ?? 'you'}」`,
      'imperative-verbs': '指令使用祈使句',
      'forbid-words': `禁用模糊词 [${(r.words ?? []).join(', ')}]`,
    };
    return `${typeMap[r.type] ?? r.type}${r.error ? ` — ${r.error}` : ''}`;
  } catch {
    return '（规则数据异常）';
  }
}

const KIND_LABELS: Record<string, { label: string; cls: string }> = {
  structure: { label: '结构', cls: 'rs-k-structure' },
  order: { label: '顺序', cls: 'rs-k-order' },
  format: { label: '格式', cls: 'rs-k-format' },
  style: { label: '风格', cls: 'rs-k-style' },
};

export default function RulesetManager() {
  useAutoTour('ruleset');
  const rulesetId = useStore(s => s.rulesetId);
  const setRuleset = useStore(s => s.setRuleset);
  const customRulesets = useStore(s => s.customRulesets);
  const saveCustomRuleset = useStore(s => s.saveCustomRuleset);
  const removeCustomRuleset = useStore(s => s.removeCustomRuleset);
  const openRulesetImport = useStore(s => s.openRulesetImport);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editing, setEditing] = useState<{ rs: RuleSet; json: string; error: string } | null>(null);

  const builtinList = Object.values(RULESETS);
  const allRulesets = [...builtinList, ...customRulesets];

  const createBlank = async () => {
    if (!newName.trim()) return;
    const rs: RuleSet = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      structureRules: [],
      orderRules: [],
      formatRules: [],
      styleRules: [],
      allowUnknownModules: true,
    };
    await saveCustomRuleset(rs);
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
  };

  const duplicateBuiltin = async (rs: RuleSet) => {
    const copy: RuleSet = {
      ...rs,
      id: `custom-${Date.now()}`,
      name: `${rs.name}（副本）`,
      structureRules: rs.structureRules.map(r => ({ ...r })),
      orderRules: rs.orderRules.map(r => ({ ...r })),
      formatRules: rs.formatRules.map(r => ({ ...r })),
      styleRules: rs.styleRules.map(r => ({ ...r })),
    };
    await saveCustomRuleset(copy);
    setExpandedId(copy.id);
  };

  const openEdit = (rs: RuleSet) => {
    setEditing({ rs, json: JSON.stringify(rs, null, 2), error: '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      const parsed = JSON.parse(editing.json);
      if (!parsed.id || !parsed.name) {
        setEditing({ ...editing, error: 'JSON 必须包含 id 与 name 字段' });
        return;
      }
      await saveCustomRuleset(parsed as RuleSet);
      setEditing(null);
    } catch (e) {
      setEditing({ ...editing, error: `JSON 解析失败：${String(e)}` });
    }
  };

  const renderRuleKinds = (rs: RuleSet) => {
    const kinds: { key: 'structure' | 'order' | 'format' | 'style'; rules: unknown[] }[] = [
      { key: 'structure', rules: rs.structureRules },
      { key: 'order', rules: rs.orderRules },
      { key: 'format', rules: rs.formatRules },
      { key: 'style', rules: rs.styleRules },
    ];
    return kinds
      .filter(k => k.rules.length > 0)
      .map(k => (
        <div key={k.key} className="rs-kind-group">
          <div className={`rs-kind-title ${KIND_LABELS[k.key].cls}`}>
            {KIND_LABELS[k.key].label}规则 · {k.rules.length} 条
          </div>
          <div className="rs-kind-rules">
            {k.rules.map((_, i) => (
              <div key={i} className="rs-kind-rule">
                <span className={`rs-kind-dot ${KIND_LABELS[k.key].cls}`} />
                {ruleLine(rs, k.key, i)}
              </div>
            ))}
          </div>
        </div>
      ));
  };

  return (
    <div className="ruleset-manager">
      <div className="rsm-head">
        <div>
          <div className="rsm-title">
            <ListTree size={18} /> 规则集管理
          </div>
          <div className="rsm-sub">查看各规则配置逻辑与校验情况，支持自定义编辑与导入</div>
        </div>
        <div className="rsm-actions">
          <TourButton id="ruleset" />
          <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(true)}>
            <Plus size={12} /> 新建空白自定义
          </button>
          <button className="btn btn-primary btn-sm" onClick={openRulesetImport}>
            <Upload size={12} /> 导入规则集
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="rsm-create">
          <input
            className="ws-input"
            placeholder="规则集名称，如：我的财经分析规范"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void createBlank()}
          />
          <input
            className="ws-input"
            placeholder="描述（可选）"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
          />
          <div className="rsm-create-actions">
            <button className="btn btn-primary btn-sm" onClick={() => void createBlank()} disabled={!newName.trim()}>
              创建
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>取消</button>
          </div>
        </div>
      )}

      <div className="rsm-list">
        {allRulesets.map(rs => {
          const isBuiltin = !!RULESETS[rs.id];
          const isActive = rulesetId === rs.id;
          const expanded = expandedId === rs.id;
          return (
            <div key={rs.id} className={`rsm-card ${isActive ? 'active' : ''}`}>
              <div className="rsm-card-head" onClick={() => setExpandedId(expanded ? null : rs.id)}>
                <span className="rsm-expand">
                  {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <div className="rsm-card-info">
                  <div className="rsm-card-name">
                    {rs.name}
                    <span className={`rsm-badge ${isBuiltin ? 'builtin' : 'custom'}`}>
                      {isBuiltin ? '内置' : '自定义'}
                    </span>
                    {isActive && <span className="rsm-current">当前使用</span>}
                  </div>
                  <div className="rsm-card-meta">
                    结构 {rs.structureRules.length} · 顺序 {rs.orderRules.length} · 格式 {rs.formatRules.length} · 风格 {rs.styleRules.length}
                    {rs.allowUnknownModules ? ' · 允许未知模块' : ''}
                  </div>
                </div>
                <div className="rsm-card-actions" onClick={e => e.stopPropagation()}>
                  {!isActive && (
                    <button className="btn btn-secondary btn-xs" onClick={() => void setRuleset(rs.id)} title="切换为当前规则集">
                      <Check size={11} /> 使用
                    </button>
                  )}
                  {isBuiltin ? (
                    <button className="btn btn-ghost btn-xs" onClick={() => void duplicateBuiltin(rs)} title="复制为自定义规则集（可编辑）">
                      <Copy size={11} /> 复制为自定义
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-ghost btn-xs" onClick={() => openEdit(rs)} title="编辑（JSON）">
                        <Pencil size={11} /> 编辑
                      </button>
                      <button className="btn btn-ghost btn-xs" onClick={() => void removeCustomRuleset(rs.id)} title="删除自定义规则集">
                        <Trash2 size={11} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {expanded && (
                <div className="rsm-card-body">
                  {rs.description && <div className="rsm-desc">{rs.description}</div>}
                  {rs.structureRules.length + rs.orderRules.length + rs.formatRules.length + rs.styleRules.length === 0 ? (
                    <div className="rsm-empty-rules">
                      <AlertTriangle size={14} /> 该规则集未配置任何规则（空白模板）
                    </div>
                  ) : (
                    renderRuleKinds(rs)
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 编辑弹层（JSON） */}
      {editing && (
        <div className="settings-overlay" onClick={e => { if (e.target === e.currentTarget) setEditing(null); }}>
          <div className="settings-dialog animate-scaleIn" style={{ width: 640 }}>
            <div className="settings-header">
              <span className="sd-title">编辑规则集 · {editing.rs.name}</span>
              <button className="btn btn-icon btn-ghost btn-sm" onClick={() => setEditing(null)}>
                <X size={14} />
              </button>
            </div>
            <div className="settings-body">
              <div className="settings-form-group">
                <label>规则配置（JSON）</label>
                <textarea
                  className="rsm-json-editor"
                  spellCheck={false}
                  value={editing.json}
                  onChange={e => setEditing({ ...editing, json: e.target.value, error: '' })}
                />
                {editing.error && <div className="rsm-json-error">{editing.error}</div>}
                <div className="hint" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                  字段说明：structureRules（结构）/ orderRules（顺序）/ formatRules（格式）/ styleRules（风格）——参考内置规则集的结构编写
                </div>
              </div>
            </div>
            <div className="settings-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>取消</button>
              <button className="btn btn-primary btn-sm" onClick={() => void saveEdit()}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
