import { useRef, useEffect, useState, useCallback } from 'react';
import {
  EditorState, Compartment, StateField, Annotation,
  type Extension, type Text,
} from '@codemirror/state';
import {
  EditorView, keymap, lineNumbers, highlightActiveLine, drawSelection,
  Decoration, type DecorationSet,
} from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown } from '@codemirror/lang-markdown';
import {
  syntaxHighlighting, bracketMatching,
  foldGutter, indentOnInput, HighlightStyle,
} from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { autocompletion } from '@codemirror/autocomplete';
import { linter, lintGutter, type Diagnostic } from '@codemirror/lint';
import { useStore } from '../../store/useStore';
import type { ValidationIssue, WorkspaceScope, SelectionQuickActionType } from '../../types';
import { parseModulesFromContent } from '../../lib/scopeParse';
import SelectionToolbar from '../shared/SelectionToolbar';
import { useEffectiveDark } from '../../hooks/useTheme';

// ── Light theme syntax highlighting (matches promptstudio-app.html token colors) ──
const lightHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#AF00DB' },
  { tag: t.string, color: '#A31515' },
  { tag: t.comment, color: '#008000', fontStyle: 'italic' },
  { tag: t.heading, color: '#001080', fontWeight: '600' },
  { tag: t.propertyName, color: '#001080' },
  { tag: t.function(t.variableName), color: '#795E26' },
  { tag: t.operator, color: '#000000' },
  { tag: t.number, color: '#098658' },
  { tag: t.bool, color: '#0000FF' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.link, color: '#0070C1', textDecoration: 'underline' },
  { tag: t.meta, color: '#808080' },
  { tag: t.invalid, color: '#FF0000', textDecoration: 'underline' },
]);

// ── Dark theme syntax highlighting（品牌靛蓝之外的代码 token，对齐 VS Code Dark+） ──
const darkHighlightStyle = HighlightStyle.define([
  { tag: t.keyword, color: '#C586C0' },
  { tag: t.string, color: '#CE9178' },
  { tag: t.comment, color: '#6A9955', fontStyle: 'italic' },
  { tag: t.heading, color: '#9CDCFE', fontWeight: '600' },
  { tag: t.propertyName, color: '#9CDCFE' },
  { tag: t.function(t.variableName), color: '#DCDCAA' },
  { tag: t.operator, color: '#D4D4D4' },
  { tag: t.number, color: '#B5CEA8' },
  { tag: t.bool, color: '#569CD6' },
  { tag: t.emphasis, fontStyle: 'italic' },
  { tag: t.strong, fontWeight: '600' },
  { tag: t.link, color: '#4FC1FF', textDecoration: 'underline' },
  { tag: t.meta, color: '#8A8F98' },
  { tag: t.invalid, color: '#FF6B6B', textDecoration: 'underline' },
]);

// ── Inline validation lint (P0-2) ──

/** Map store validation issues (1-based line numbers) to CM6 diagnostics. */
function mapIssues(view: EditorView, issues: ValidationIssue[]): Diagnostic[] {
  return issues.map(issue => {
    const lineNo = Math.min(Math.max(issue.line, 1), view.state.doc.lines);
    const line = view.state.doc.line(lineNo);
    return {
      from: line.from,
      to: line.to,
      severity: issue.severity,
      message: issue.message,
    };
  });
}

function createLinter(issues: ValidationIssue[]) {
  return linter((view) => mapIssues(view, issues));
}

// ── Workspace read-only enforcement (P1-9) ──

/**
 * Annotation marking programmatic (store-driven) document replacements.
 * The read-only transactionFilter lets these through — only user edits
 * inside locked regions are blocked.
 */
const externalEditAnnotation = Annotation.define<boolean>();

/** Normalize a heading for scope matching (strip leading #'s, trim). */
function normalizeHeading(heading: string): string {
  return heading.replace(/^#{1,6}\s*/, '').trim();
}

interface EditableRange {
  from: number;
  to: number;
}

/**
 * Compute editable ranges by re-parsing the CURRENT document and matching
 * module headings against the active scope. Re-parsing on every call makes
 * the enforcement immune to line-number drift (impl-plan §6.5): the stored
 * startLine/endLine in the scope are display-only.
 */
function computeEditableRanges(doc: Text, scope: WorkspaceScope): EditableRange[] {
  if (scope.locked) return [];
  const editableHeadings = new Set(
    scope.modules
      .filter(m => m.selected && !m.locked)
      .map(m => normalizeHeading(m.heading)),
  );
  if (editableHeadings.size === 0) return [];

  const modules = parseModulesFromContent(doc.toString());
  const ranges: EditableRange[] = [];
  for (const mod of modules) {
    if (!editableHeadings.has(normalizeHeading(mod.heading))) continue;
    const startLine = Math.min(Math.max(mod.startLine, 1), doc.lines);
    const endLine = Math.min(Math.max(mod.endLine, startLine), doc.lines);
    ranges.push({ from: doc.line(startLine).from, to: doc.line(endLine).to });
  }
  return ranges;
}

/** Line decorations marking read-only lines with the cm-locked-line class. */
function lockedLineDecorations(doc: Text, scope: WorkspaceScope): DecorationSet {
  const editable = computeEditableRanges(doc, scope);
  const lockedLine = Decoration.line({ class: 'cm-locked-line' });
  const decos = [];
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const inside = editable.some(r => line.from >= r.from && line.to <= r.to);
    if (!inside) decos.push(lockedLine.range(line.from));
  }
  return Decoration.set(decos, true);
}

/**
 * Build the read-only extension set for the active workspace scope:
 * a transactionFilter blocking edits outside editable (selected & unlocked)
 * modules, plus line decorations for the locked regions.
 * Returns [] when no scope is active (everything editable).
 */
function buildReadOnlyExtensions(scope: WorkspaceScope | null): Extension {
  if (!scope) return [];

  const filter = EditorState.transactionFilter.of(tr => {
    if (!tr.docChanged) return tr;
    // Programmatic replacements (version restore, confirm auto-organize, …) pass through
    if (tr.annotation(externalEditAnnotation)) return tr;
    const ranges = computeEditableRanges(tr.startState.doc, scope);
    let blocked = false;
    tr.changes.iterChanges((fromA, toA) => {
      if (!ranges.some(r => fromA >= r.from && toA <= r.to)) blocked = true;
    });
    return blocked ? [] : tr;
  });

  const lockedLinesField = StateField.define<DecorationSet>({
    create(state) {
      return lockedLineDecorations(state.doc, scope);
    },
    update(_deco, tr) {
      if (!tr.docChanged) return _deco;
      return lockedLineDecorations(tr.state.doc, scope);
    },
    provide: field => EditorView.decorations.from(field),
  });

  return [filter, lockedLinesField];
}

// ── Component ──

interface ToolbarState {
  visible: boolean;
  top: number;
  left: number;
  bottom: number;
  charCount: number;
}

const HIDDEN_TOOLBAR: ToolbarState = { visible: false, top: 0, left: 0, bottom: 0, charCount: 0 };

export default function CodeEditor() {
  const editorHostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Compartments live in refs so effects can reconfigure without rebuilding the view
  const languageConfRef = useRef<Compartment | null>(null);
  const lintConfRef = useRef<Compartment | null>(null);
  const readOnlyConfRef = useRef<Compartment | null>(null);
  const themeConfRef = useRef<Compartment | null>(null);

  const isDark = useEffectiveDark();

  const docContent = useStore(s => s.docContent);
  const setDocContent = useStore(s => s.setDocContent);
  const editingFilePath = useStore(s => s.editingFilePath);
  const importedFiles = useStore(s => s.importedFiles);
  const updateImportedFileContent = useStore(s => s.updateImportedFileContent);
  const setSelectedText = useStore(s => s.setSelectedText);
  const validationIssues = useStore(s => s.validationIssues);
  const pendingJumpLine = useStore(s => s.pendingJumpLine);
  const workspaceScopes = useStore(s => s.workspaceScopes);
  const currentScopeId = useStore(s => s.currentScopeId);
  const selectionQuickAction = useStore(s => s.selectionQuickAction);

  // 文件编辑模式：显示/编辑导入文件内容；否则为主文档
  const activeContent = editingFilePath
    ? (importedFiles.find(f => f.path === editingFilePath)?.content ?? '')
    : docContent;
  /** 当前编辑目标（null = 主文档），供 updateListener 闭包读取最新值 */
  const editingPathRef = useRef<string | null>(editingFilePath);
  editingPathRef.current = editingFilePath;

  // Floating selection toolbar state (viewport coordinates, P1-8)
  const [toolbar, setToolbar] = useState<ToolbarState>(HIDDEN_TOOLBAR);

  const hideToolbar = useCallback(() => {
    setToolbar(prev => (prev.visible ? HIDDEN_TOOLBAR : prev));
  }, []);

  /**
   * Debounced selection tracker: syncs the selection to the store
   * (incremental-mode context, P0-4) and positions the floating toolbar
   * once the selection is ≥ 2 non-whitespace characters.
   */
  const updateSelectionToolbar = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;

    const selection = view.state.selection.main;
    if (selection.empty) {
      setSelectedText('');
      hideToolbar();
      return;
    }

    const text = view.state.sliceDoc(selection.from, selection.to);
    setSelectedText(text);

    if (text.trim().length < 2) {
      hideToolbar();
      return;
    }

    try {
      const startCoords = view.coordsAtPos(selection.from);
      const endCoords = view.coordsAtPos(selection.to);
      if (!startCoords || !endCoords) return;
      setToolbar({
        visible: true,
        top: Math.min(startCoords.top, endCoords.top),
        bottom: Math.max(startCoords.bottom, endCoords.bottom),
        left: endCoords.right,
        charCount: text.length,
      });
    } catch {
      hideToolbar();
    }
  }, [setSelectedText, hideToolbar]);

  /** Dispatch the toolbar action to the store with editor selection context. */
  const handleQuickAction = useCallback((action: SelectionQuickActionType) => {
    const view = viewRef.current;
    if (!view) return;
    const selection = view.state.selection.main;
    if (selection.empty) return;

    const text = view.state.sliceDoc(selection.from, selection.to);
    const startLine = view.state.doc.lineAt(selection.from).number;
    const endLine = view.state.doc.lineAt(selection.to).number;
    selectionQuickAction(action, { text, source: 'editor', startLine, endLine });
    setToolbar(HIDDEN_TOOLBAR);
  }, [selectionQuickAction]);

  // Debounced selection update
  const selTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!editorHostRef.current || viewRef.current) return;

    const languageConf = new Compartment();
    const lintConf = new Compartment();
    const readOnlyConf = new Compartment();
    languageConfRef.current = languageConf;
    lintConfRef.current = lintConf;
    readOnlyConfRef.current = readOnlyConf;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString();
        // 文件切换后 updateListener 闭包仍持有旧值，须经 ref 读取当前编辑目标
        const path = editingPathRef.current;
        if (path) {
          updateImportedFileContent(path, newContent);
        } else {
          setDocContent(newContent);
        }
      }
      // Track selection changes (80ms debounce, shared by toolbar + store sync)
      if (update.selectionSet || update.docChanged) {
        if (selTimerRef.current) clearTimeout(selTimerRef.current);
        selTimerRef.current = setTimeout(() => updateSelectionToolbar(), 80);
      }
    });

    // Dom event listener for mouseup (selection via mouse)
    const handleDomMouseUp = () => {
      if (selTimerRef.current) clearTimeout(selTimerRef.current);
      selTimerRef.current = setTimeout(() => updateSelectionToolbar(), 80);
    };

    const state = EditorState.create({
      doc: activeContent,
      extensions: [
        lineNumbers(),
        foldGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        autocompletion(),
        highlightActiveLine(),
        (themeConfRef.current = new Compartment()).of(
          syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle)
        ),
        languageConf.of(markdown()),
        lintGutter(),
        lintConf.of([]),
        readOnlyConf.of([]),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        updateListener,
        EditorView.lineWrapping,
        EditorView.domEventHandlers({
          mouseup: handleDomMouseUp,
          keyup: (e) => {
            // Track keyboard-driven selection (Shift+Arrow, Ctrl+A)
            if (e instanceof KeyboardEvent && (e.shiftKey || e.ctrlKey || e.metaKey)) {
              setTimeout(() => updateSelectionToolbar(), 80);
            }
          },
        }),
        EditorView.theme({
          '&': {
            backgroundColor: 'var(--bg-darkest)',
            color: 'var(--text-primary)',
          },
          '.cm-content': {
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            padding: '8px 0',
          },
          '.cm-gutters': {
            backgroundColor: 'var(--bg-dark)',
            borderRight: '1px solid var(--border)',
            color: 'var(--text-muted)',
          },
          '.cm-activeLine': {
            backgroundColor: 'rgba(99, 102, 241, 0.05)',
          },
          '.cm-activeLineGutter': {
            backgroundColor: 'rgba(99, 102, 241, 0.08)',
          },
          // FIXED: High-contrast selection with distinct background
          '.cm-selectionBackground, ::selection': {
            backgroundColor: 'rgba(99, 102, 241, 0.35) !important',
            color: 'var(--text-primary) !important',
          },
          '.cm-selectionMatch': {
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
          },
          '.cm-cursor': {
            borderLeftColor: 'var(--brand-light)',
          },
          '.cm-foldPlaceholder': {
            backgroundColor: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '0 8px',
            color: 'var(--text-muted)',
          },
          '.cm-lint-marker': {
            width: '4px',
          },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorHostRef.current,
    });

    viewRef.current = view;

    return () => {
      if (selTimerRef.current) clearTimeout(selTimerRef.current);
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Only create once

  // Update content when the active content changes externally (annotated so the
  // read-only filter lets programmatic replacements through)
  useEffect(() => {
    if (viewRef.current && activeContent !== viewRef.current.state.doc.toString()) {
      viewRef.current.dispatch({
        changes: {
          from: 0,
          to: viewRef.current.state.doc.length,
          insert: activeContent,
        },
        annotations: externalEditAnnotation.of(true),
      });
    }
  }, [activeContent]);

  // 主题切换：重配语法高亮（背景/文字走 CSS 变量，无需重建编辑器）
  useEffect(() => {
    const view = viewRef.current;
    const conf = themeConfRef.current;
    if (!view || !conf) return;
    view.dispatch({
      effects: conf.reconfigure(syntaxHighlighting(isDark ? darkHighlightStyle : lightHighlightStyle)),
    });
  }, [isDark]);

  // P0-2: reconfigure the inline linter when validation issues change
  // （文件模式下使用文件内容的校验结果）
  const fileValidationIssues = useStore(s => s.fileValidationIssues);
  const lintIssues = editingFilePath ? fileValidationIssues : validationIssues;
  useEffect(() => {
    const view = viewRef.current;
    const lintConf = lintConfRef.current;
    if (!view || !lintConf) return;
    view.dispatch({
      effects: lintConf.reconfigure(
        lintIssues.length ? createLinter(lintIssues) : [],
      ),
    });
  }, [lintIssues]);

  // P0-3: consume the jump-to-line intent (scroll + select + focus)
  useEffect(() => {
    const view = viewRef.current;
    if (!view || pendingJumpLine == null) return;
    const lineNo = Math.min(Math.max(pendingJumpLine, 1), view.state.doc.lines);
    const pos = view.state.doc.line(lineNo).from;
    view.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    });
    view.focus();
    useStore.setState({ pendingJumpLine: null });
  }, [pendingJumpLine]);

  // P1-9: reconfigure read-only enforcement when the active scope changes
  useEffect(() => {
    const view = viewRef.current;
    const readOnlyConf = readOnlyConfRef.current;
    if (!view || !readOnlyConf) return;
    const scope = workspaceScopes.find(s => s.id === currentScopeId) ?? null;
    view.dispatch({
      effects: readOnlyConf.reconfigure(buildReadOnlyExtensions(scope)),
    });
  }, [workspaceScopes, currentScopeId]);

  return (
    <div className="cm-wrapper" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
      <div ref={editorHostRef} className="cm-host" style={{ height: '100%', overflow: 'auto' }} />

      {/* Floating selection toolbar (P1-8) */}
      {toolbar.visible && (
        <SelectionToolbar
          anchor={{ top: toolbar.top, left: toolbar.left, bottom: toolbar.bottom }}
          charCount={toolbar.charCount}
          source="editor"
          onAction={handleQuickAction}
          onClose={hideToolbar}
        />
      )}
    </div>
  );
}
