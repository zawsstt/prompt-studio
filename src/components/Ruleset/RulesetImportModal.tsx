import { useRef, useState } from 'react';
import { useStore } from '../../store/useStore';
import { extractRulesetFromMarkdown } from '../../lib/rulesetExtract';
import { toast } from '../shared/Toast';
import { X, Upload, FileText, CheckSquare, Square } from 'lucide-react';
import type { RuleSet, StructureRule, OrderRule, FormatRule } from '../../types';

/**
 * RulesetImportModal (P1-5) — import a convention/spec markdown file,
 * preview the deterministically extracted RuleSet draft (three rule groups
 * with per-rule keep/drop checkboxes + editable name), then persist it via
 * saveCustomRuleset and activate it immediately.
 */
export default function RulesetImportModal() {
  const open = useStore(s => s.rulesetImportOpen);
  const closeRulesetImport = useStore(s => s.closeRulesetImport);
  const saveCustomRuleset = useStore(s => s.saveCustomRuleset);
  const setRuleset = useStore(s => s.setRuleset);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<RuleSet | null>(null);
  const [name, setName] = useState('');
  /** Keys of rules the user unchecked, formatted as `<group>:<index>`. */
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const reset = () => {
    setDraft(null);
    setName('');
    setExcluded(new Set());
    setDragOver(false);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    closeRulesetImport();
  };

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const extracted = extractRulesetFromMarkdown(text, file.name);
      setDraft(extracted);
      setName(extracted.name);
      setExcluded(new Set());
    } catch (err) {
      console.error('读取规范文档失败', err);
      toast('读取文件失败，请确认是可读的 Markdown 文档', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  const toggleRule = (key: string) => {
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!draft || !name.trim() || saving) return;
    setSaving(true);
    try {
      const finalRuleset: RuleSet = {
        ...draft,
        name: name.trim(),
        structureRules: draft.structureRules.filter((_, i) => !excluded.has(`structure:${i}`)),
        orderRules: draft.orderRules
          .filter((_, i) => !excluded.has(`order:${i}`))
          .map((r, i) => ({ ...r, position: i })),
        formatRules: draft.formatRules.filter((_, i) => !excluded.has(`format:${i}`)),
      };
      await saveCustomRuleset(finalRuleset);
      // Take effect immediately (appears in the TopBar dropdown as active).
      await setRuleset(finalRuleset.id);
      toast(`规则集「${finalRuleset.name}」已导入并启用`, 'success');
      handleClose();
    } catch (err) {
      console.error('保存自定义规则集失败', err);
      toast('规则集保存失败', 'error');
      setSaving(false);
    }
  };

  const totalRules = draft
    ? draft.structureRules.length + draft.orderRules.length + draft.formatRules.length
    : 0;
  const keptRules = totalRules - excluded.size;

  return (
    <div className="settings-overlay active" onClick={(e) => {
      if (e.target === e.currentTarget) handleClose();
    }}>
      <div className="settings-dialog animate-scaleIn ruleset-import-dialog">
        <div className="settings-header">
          <span>导入规则集</span>
          <button className="btn btn-icon btn-ghost btn-sm" onClick={handleClose} title="关闭">
            <X size={14} />
          </button>
        </div>

        <div className="settings-body">
          {/* Dropzone / file picker */}
          <div
            className={`rs-dropzone ${dragOver ? 'dragover' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload size={20} />
            <p>点击选择或拖拽规范文档（.md / .markdown / .txt）</p>
            <p style={{ fontSize: '10px', opacity: 0.6 }}>
              将从文档中提炼 frontmatter 字段、模块顺序与格式规则
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.markdown,.txt"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          {/* Draft preview */}
          {draft && (
            <>
              <div className="settings-form-group">
                <label>规则集名称</label>
                <input
                  className="inp"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="规则集名称"
                />
              </div>

              <div className="rs-preview-summary">
                <FileText size={11} /> 提炼出 {totalRules} 条规则，保留 {keptRules} 条（可逐条勾选去留）
              </div>

              {draft.structureRules.length > 0 && (
                <RuleGroup title="结构规则">
                  {draft.structureRules.map((rule, i) => (
                    <RuleRow
                      key={`structure:${i}`}
                      checked={!excluded.has(`structure:${i}`)}
                      onToggle={() => toggleRule(`structure:${i}`)}
                      label={describeStructureRule(rule)}
                    />
                  ))}
                </RuleGroup>
              )}

              {draft.orderRules.length > 0 && (
                <RuleGroup title="模块顺序">
                  {draft.orderRules.map((rule, i) => (
                    <RuleRow
                      key={`order:${i}`}
                      checked={!excluded.has(`order:${i}`)}
                      onToggle={() => toggleRule(`order:${i}`)}
                      label={`位置 ${rule.position}: ${rule.module}`}
                    />
                  ))}
                </RuleGroup>
              )}

              {draft.formatRules.length > 0 && (
                <RuleGroup title="格式规则">
                  {draft.formatRules.map((rule, i) => (
                    <RuleRow
                      key={`format:${i}`}
                      checked={!excluded.has(`format:${i}`)}
                      onToggle={() => toggleRule(`format:${i}`)}
                      label={describeFormatRule(rule)}
                    />
                  ))}
                </RuleGroup>
              )}

              {totalRules === 0 && (
                <div className="rs-preview-summary" style={{ color: 'var(--warn)' }}>
                  未能从该文档提炼出规则，仍可保存为空白自定义规则集。
                </div>
              )}
            </>
          )}
        </div>

        <div className="settings-footer">
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>
            取消
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={!draft || !name.trim() || saving}
          >
            {saving ? '保存中…' : '确认导入并启用'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Presentational helpers ──

function RuleGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rs-rule-group">
      <div className="rs-rule-group-title">{title}</div>
      <div className="rs-rule-list">{children}</div>
    </div>
  );
}

function RuleRow({ checked, onToggle, label }: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <div className={`rs-rule-row ${checked ? '' : 'rs-rule-excluded'}`} onClick={onToggle}>
      <span className="rs-rule-check">
        {checked ? <CheckSquare size={13} /> : <Square size={13} />}
      </span>
      <span className="rs-rule-label">{label}</span>
    </div>
  );
}

function describeStructureRule(rule: StructureRule): string {
  switch (rule.type) {
    case 'require-frontmatter':
      return `必须包含 frontmatter 字段：${(rule.fields ?? []).join(', ')}`;
    case 'require-module':
      return `必须包含模块：${rule.module ?? ''}`;
    case 'forbid-module':
      return `禁止模块：${rule.module ?? ''}`;
    case 'forbid-field':
      return `禁止 frontmatter 字段：${(rule.fields ?? []).join(', ')}`;
    default:
      return rule.error;
  }
}

function describeFormatRule(rule: FormatRule): string {
  switch (rule.type) {
    case 'codeblock-language':
      return '代码块必须标注语言';
    case 'heading-depth':
      return `标题层级不超过 ${rule.max ?? '?'} 层`;
    case 'line-width':
      return `行宽不超过 ${rule.max ?? '?'} 字符`;
    case 'yaml-frontmatter':
      return 'frontmatter 必须为合法 YAML';
    default:
      return rule.error ?? rule.type;
  }
}
