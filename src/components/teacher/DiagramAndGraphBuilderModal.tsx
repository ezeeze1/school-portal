import React, { useMemo, useState } from 'react';
import type { CBTDiagramSpec, DiagramPlacement } from '../../types/cbtDiagram';
import type { CBTQuestion } from '../../types';
import {
  attachDiagramToText,
  parseDiagramToken,
  replaceDiagramTokenInText,
  serializeDiagramToken,
} from '../../lib/diagramFormatting';
import { DIAGRAM_TEMPLATES } from '../../lib/diagramTemplates';
import { GeometryDiagramBuilder } from './GeometryDiagramBuilder';
import { GraphBuilder } from './GraphBuilder';
import { DiagramPreview } from './DiagramPreview';
import {
  X,
  CheckCircle2,
  Shapes,
  LineChart,
  Eye,
  AlertCircle,
} from 'lucide-react';

export type DiagramTargetField = 'question' | 'A' | 'B' | 'C' | 'D' | 'explanation';

export interface DiagramModalSavePayload {
  token: string;
  spec: CBTDiagramSpec;
  targetField: DiagramTargetField;
  placement: DiagramPlacement;
  replacingToken?: string;
}

interface DiagramAndGraphBuilderModalProps {
  isOpen: boolean;
  initialMode?: 'geometry' | 'graph';
  question: CBTQuestion;
  questionNumber: number;
  initialTargetField?: DiagramTargetField;
  editingToken?: string | null;
  allowExplanationTarget?: boolean;
  onClose: () => void;
  onSaveDiagram: (payload: DiagramModalSavePayload) => void;
}

function createInitialGeometrySpec(): CBTDiagramSpec {
  const rectTpl = DIAGRAM_TEMPLATES.find((t) => t.id === 'tpl-rectangle-dimensions');
  if (rectTpl) return rectTpl.createSpec();
  return {
    version: 1,
    mode: 'geometry',
    width: 520,
    height: 320,
    gridEnabled: true,
    snapToGrid: true,
    gridSize: 20,
    notDrawnToScale: false,
    geometry: { elements: [] },
  };
}

function createInitialGraphSpec(): CBTDiagramSpec {
  const linearTpl = DIAGRAM_TEMPLATES.find((t) => t.id === 'tpl-linear-graph');
  if (linearTpl) return linearTpl.createSpec();
  return {
    version: 1,
    mode: 'graph',
    width: 540,
    height: 360,
    graph: {
      xMin: -5,
      xMax: 5,
      yMin: -5,
      yMax: 5,
      xStep: 1,
      yStep: 1,
      xLabel: 'x',
      yLabel: 'y',
      showGrid: true,
      showOriginLabel: true,
      equations: [
        { id: 'eq-1', expression: 'y = 2x + 1', label: 'y = 2x + 1', color: '#2563eb', strokeWidth: 2.5 },
      ],
      points: [],
      connectPoints: false,
    },
  };
}

export const DiagramAndGraphBuilderModal: React.FC<DiagramAndGraphBuilderModalProps> = ({
  isOpen,
  initialMode = 'geometry',
  question,
  questionNumber,
  initialTargetField = 'question',
  editingToken = null,
  allowExplanationTarget = false,
  onClose,
  onSaveDiagram,
}) => {
  const parsedEdit = useMemo(() => {
    if (!editingToken) return null;
    const res = parseDiagramToken(editingToken);
    return res.ok && res.spec ? res.spec : null;
  }, [editingToken]);

  const [spec, setSpec] = useState<CBTDiagramSpec>(() => {
    if (parsedEdit) return parsedEdit;
    return initialMode === 'graph' ? createInitialGraphSpec() : createInitialGeometrySpec();
  });

  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'geometry' | 'graph' | 'preview'>(() => {
    if (parsedEdit) {
      return parsedEdit.mode === 'geometry' ? 'geometry' : 'graph';
    }
    return initialMode;
  });

  const [targetField, setTargetField] = useState<DiagramTargetField>(initialTargetField);
  const [placement, setPlacement] = useState<DiagramPlacement>('below');
  const [saveError, setSaveError] = useState<string | null>(null);

  // Build simulated question with current draft diagram attached so Student View Preview reflects live edits
  const previewQuestion = useMemo<CBTQuestion>(() => {
    const serialized = serializeDiagramToken(spec);
    if (!serialized.ok || !serialized.token) return question;
    const token = serialized.token;

    const copy: CBTQuestion = {
      ...question,
      options: { ...question.options },
    };

    const applyToField = (currentText: string) =>
      editingToken && targetField === initialTargetField
        ? replaceDiagramTokenInText(currentText, editingToken, token)
        : attachDiagramToText(currentText, token, placement);

    if (targetField === 'question') {
      copy.question = applyToField(copy.question);
    } else if (targetField === 'explanation') {
      copy.explanation = applyToField(copy.explanation || '');
    } else {
      copy.options[targetField] = applyToField(copy.options[targetField]);
    }
    return copy;
  }, [spec, question, targetField, placement, editingToken, initialTargetField]);

  if (!isOpen) return null;

  const handleSwitchMode = (next: 'geometry' | 'graph') => {
    setSaveError(null);
    setActiveWorkspaceTab(next);
    if (next === 'geometry' && spec.mode !== 'geometry') {
      setSpec((prev) => ({
        ...createInitialGeometrySpec(),
        title: prev.title,
        notDrawnToScale: prev.notDrawnToScale,
      }));
    } else if (next === 'graph' && spec.mode === 'geometry') {
      setSpec((prev) => ({
        ...createInitialGraphSpec(),
        title: prev.title,
        notDrawnToScale: prev.notDrawnToScale,
      }));
    }
  };

  const handleConfirmAttach = () => {
    setSaveError(null);
    if (spec.mode === 'geometry' && (!spec.geometry?.elements || spec.geometry.elements.length === 0)) {
      setSaveError('Add at least one shape, line, angle, or label (or select a template) before attaching.');
      return;
    }

    const res = serializeDiagramToken(spec);
    if (!res.ok || !res.token) {
      setSaveError(res.error || 'Unable to validate diagram specification.');
      return;
    }

    onSaveDiagram({
      token: res.token,
      spec,
      targetField,
      placement,
      replacingToken: editingToken || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden my-auto">
        {/* Top Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90">
          <div>
            <h3 className="font-serif font-bold text-lg sm:text-xl text-slate-900 dark:text-white">
              {editingToken ? 'Edit CBT Diagram / Graph' : 'CBT Geometry, Diagram & Graph Builder'}
            </h3>
            <p className="text-[11px] text-slate-500">
              Question #{questionNumber} · Pure SVG vector graphics for computers, Android phones &amp; tablets
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleSwitchMode('geometry')}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeWorkspaceTab === 'geometry'
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Shapes className="w-3.5 h-3.5" /> Geometry &amp; Diagrams
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('graph')}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeWorkspaceTab === 'graph'
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <LineChart className="w-3.5 h-3.5" /> Graphs &amp; Charts
            </button>
            <button
              type="button"
              onClick={() => setActiveWorkspaceTab('preview')}
              className={`px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap ${
                activeWorkspaceTab === 'preview'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Student View Preview
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
              aria-label="Close diagram builder"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {activeWorkspaceTab === 'geometry' && (
            <GeometryDiagramBuilder
              spec={spec}
              onChange={(next) => {
                setSaveError(null);
                setSpec(next);
              }}
              onTemplateModeSwitch={(tplSpec) => {
                setSpec(tplSpec);
                setActiveWorkspaceTab(tplSpec.mode === 'geometry' ? 'geometry' : 'graph');
              }}
            />
          )}

          {activeWorkspaceTab === 'graph' && (
            <GraphBuilder
              spec={spec}
              onChange={(next) => {
                setSaveError(null);
                setSpec(next);
              }}
            />
          )}

          {activeWorkspaceTab === 'preview' && (
            <DiagramPreview
              question={previewQuestion}
              questionNumber={questionNumber}
              highlightCorrect
            />
          )}
        </div>

        {/* Bottom Attachment Bar */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                Attach To:
              </label>
              <select
                value={targetField}
                onChange={(e) => setTargetField(e.target.value as DiagramTargetField)}
                disabled={Boolean(editingToken)}
                className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold disabled:opacity-60"
              >
                <option value="question">Question Stem</option>
                <option value="A">Option A (Correct Answer)</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
                {allowExplanationTarget && <option value="explanation">Explanation</option>}
              </select>
            </div>

            {!editingToken && (
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                  Position:
                </label>
                <select
                  value={placement}
                  onChange={(e) => setPlacement(e.target.value as DiagramPlacement)}
                  className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  <option value="below">Below Text</option>
                  <option value="above">Above Text</option>
                  <option value="inline">Inline With Text</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAttach}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold inline-flex items-center gap-1.5 shadow whitespace-nowrap"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editingToken ? 'Update Diagram' : 'Attach Diagram to Question'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiagramAndGraphBuilderModal;
