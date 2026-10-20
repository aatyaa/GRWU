import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from '@codemirror/autocomplete';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { python } from '@codemirror/lang-python';
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language';
import { EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

/**
 * The exercises' code editor (ADR 0010): CodeMirror 6, coloured only with the site's tokens
 * (ADR 0006): ink for code, ink-soft for comments, signal for literals, model for keywords.
 * Tab indents; Escape then Tab moves focus out of the editor.
 */
const highlight = HighlightStyle.define([
  {
    tag: [t.keyword, t.controlKeyword, t.operatorKeyword, t.definitionKeyword, t.moduleKeyword],
    color: 'var(--model)',
    fontWeight: '600',
  },
  { tag: [t.string, t.number, t.bool, t.null, t.special(t.string)], color: 'var(--signal)' },
  { tag: [t.comment, t.lineComment, t.docString], color: 'var(--ink-soft)', fontStyle: 'italic' },
  {
    tag: [t.function(t.variableName), t.function(t.definition(t.variableName))],
    color: 'var(--ink)',
    fontWeight: '600',
  },
]);

const theme = EditorView.theme({
  '&': { color: 'var(--ink)', backgroundColor: 'var(--surface)', fontSize: '0.92rem' },
  '.cm-content': { fontFamily: 'var(--f-mono)', caretColor: 'var(--ink)', padding: '0.6rem 0' },
  '.cm-gutters': { backgroundColor: 'var(--surface-2)', color: 'var(--ink-soft)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--signal) 7%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--ink)' },
  '&.cm-focused': { outline: '2px solid var(--ink)', outlineOffset: '2px' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--model) 30%, transparent) !important',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--surface)',
    color: 'var(--ink)',
    border: '1px solid var(--rule)',
  },
});

export interface CodeEditor {
  get(): string;
  set(code: string): void;
  destroy(): void;
}

export function createEditor(
  parent: HTMLElement,
  doc: string,
  {
    label,
    onChange,
    onRun,
  }: { label: string; onChange: (code: string) => void; onRun: () => void },
): CodeEditor {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        python(),
        syntaxHighlighting(highlight),
        theme,
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({ 'aria-label': label }),
        keymap.of([
          { key: 'Mod-Enter', run: () => (onRun(), true) },
          { key: 'Shift-Enter', run: () => (onRun(), true) },
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChange(update.state.doc.toString());
        }),
      ],
    }),
  });
  return {
    get: () => view.state.doc.toString(),
    set: (code) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } }),
    destroy: () => view.destroy(),
  };
}
