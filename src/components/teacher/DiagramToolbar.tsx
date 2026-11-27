import React, { useMemo, useState } from 'react';
import type {
  CBTDiagramSpec,
  GeometryAngleKind,
  GeometryElement,
  GeometryLineKind,
  GeometryShapeKind,
} from '../../types/cbtDiagram';
import { DIAGRAM_TEMPLATES } from '../../lib/diagramTemplates';
import { Search, Shapes, Minus, Compass, BookOpen } from 'lucide-react';

interface DiagramToolbarProps {
  onAddElement: (element: GeometryElement) => void;
  onApplyTemplate: (spec: CBTDiagramSpec) => void;
}

const SHAPE_TOOLS: Array<{ kind: GeometryShapeKind; label: string }> = [
  { kind: 'rectangle', label: 'Rectangle' },
  { kind: 'square', label: 'Square' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'right_triangle', label: 'Right Triangle' },
  { kind: 'equilateral_triangle', label: 'Equilateral Tri.' },
  { kind: 'isosceles_triangle', label: 'Isosceles Tri.' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'semicircle', label: 'Semicircle' },
  { kind: 'ellipse', label: 'Ellipse' },
  { kind: 'parallelogram', label: 'Parallelogram' },
  { kind: 'trapezium', label: 'Trapezium' },
  { kind: 'rhombus', label: 'Rhombus' },
  { kind: 'kite', label: 'Kite' },
  { kind: 'polygon', label: 'Regular Polygon' },
];

const LINE_TOOLS: Array<{
  kind: GeometryLineKind;
  label: string;
  style?: 'solid' | 'dashed' | 'dotted';
  arrowEnd?: boolean;
  arrowStart?: boolean;
}> = [
  { kind: 'segment', label: 'Line Segment' },
  { kind: 'line', label: 'Arrowed Line', arrowStart: true, arrowEnd: true },
  { kind: 'horizontal', label: 'Horizontal Line' },
  { kind: 'vertical', label: 'Vertical Line' },
  { kind: 'diagonal', label: 'Diagonal Line' },
  { kind: 'segment', label: 'Dashed Line', style: 'dashed' },
  { kind: 'segment', label: 'Dotted Line', style: 'dotted' },
  { kind: 'parallel_pair', label: 'Parallel Lines', arrowStart: true, arrowEnd: true },
  { kind: 'perpendicular_pair', label: 'Perpendicular Lines' },
  { kind: 'radius', label: 'Circle Radius', style: 'dashed' },
  { kind: 'diameter', label: 'Circle Diameter' },
  { kind: 'chord', label: 'Circle Chord' },
  { kind: 'tangent', label: 'Circle Tangent', arrowStart: true, arrowEnd: true },
  { kind: 'arc', label: 'Arc' },
  { kind: 'sector', label: 'Sector' },
  { kind: 'measurement', label: 'Dimension Line', arrowStart: true, arrowEnd: true },
];

const ANGLE_TOOLS: Array<{
  kind: GeometryAngleKind;
  label: string;
  sweep: number;
  start: number;
  rightSquare?: boolean;
  defaultLabel: string;
}> = [
  { kind: 'acute', label: 'Acute Angle', start: -50, sweep: 50, defaultLabel: 'x°' },
  { kind: 'right', label: 'Right Angle (90°)', start: -90, sweep: 90, rightSquare: true, defaultLabel: '90°' },
  { kind: 'obtuse', label: 'Obtuse Angle', start: -125, sweep: 125, defaultLabel: '125°' },
  { kind: 'straight', label: 'Straight Angle (180°)', start: -180, sweep: 180, defaultLabel: '180°' },
  { kind: 'reflex', label: 'Reflex Angle', start: 0, sweep: 240, defaultLabel: '240°' },
  { kind: 'arc', label: 'Angle Arc Only', start: -45, sweep: 45, defaultLabel: 'θ' },
];

export const DiagramToolbar: React.FC<DiagramToolbarProps> = ({
  onAddElement,
  onApplyTemplate,
}) => {
  const [section, setSection] = useState<'shapes' | 'lines' | 'angles' | 'templates'>('shapes');
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategory, setTemplateCategory] = useState<string>('All');

  const filteredTemplates = useMemo(() => {
    return DIAGRAM_TEMPLATES.filter((t) => {
      if (templateCategory !== 'All' && t.category !== templateCategory) return false;
      if (templateSearch.trim()) {
        const q = templateSearch.toLowerCase();
        return (
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [templateCategory, templateSearch]);

  const makeId = (prefix: string) =>
    `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

  const handleAddShape = (shapeKind: GeometryShapeKind) => {
    const isSquareOrCircle =
      shapeKind === 'square' ||
      shapeKind === 'circle' ||
      shapeKind === 'polygon' ||
      shapeKind === 'rhombus';
    onAddElement({
      id: makeId('shp'),
      kind: 'shape',
      shapeKind,
      x: 180,
      y: 85,
      width: isSquareOrCircle ? 140 : 180,
      height: shapeKind === 'semicircle' ? 95 : 140,
      rotation: 0,
      sides: shapeKind === 'polygon' ? 5 : undefined,
      topRatio: shapeKind === 'trapezium' ? 0.56 : undefined,
      skewRatio: shapeKind === 'parallelogram' ? 0.22 : undefined,
      strokeColor: '#0f172a',
      strokeWidth: 2.5,
      fillColor: '#dbeafe',
      fillTransparent: false,
      rightAngleCorner: shapeKind === 'right_triangle' ? 2 : undefined,
      vertexLabels:
        shapeKind === 'circle' || shapeKind === 'ellipse' || shapeKind === 'semicircle'
          ? undefined
          : shapeKind.includes('triangle')
          ? ['A', 'B', 'C']
          : shapeKind === 'polygon'
          ? ['A', 'B', 'C', 'D', 'E']
          : ['A', 'B', 'C', 'D'],
      unit: 'cm',
    });
  };

  const handleAddLine = (tool: (typeof LINE_TOOLS)[number]) => {
    const id = makeId('ln');
    if (tool.kind === 'vertical') {
      onAddElement({
        id,
        kind: 'line',
        lineKind: 'vertical',
        x1: 260,
        y1: 70,
        x2: 260,
        y2: 240,
        strokeColor: '#0f172a',
        strokeWidth: 2.5,
        lineStyle: tool.style || 'solid',
        label: 'h',
      });
      return;
    }
    if (tool.kind === 'arc' || tool.kind === 'sector') {
      onAddElement({
        id,
        kind: 'line',
        lineKind: tool.kind,
        x1: 250,
        y1: 180,
        x2: 350,
        y2: 180,
        radius: 95,
        startAngleDeg: -60,
        endAngleDeg: 0,
        strokeColor: '#0f172a',
        strokeWidth: 2.5,
        fillColor: '#fde68a',
        fillTransparent: tool.kind === 'arc',
        lineStyle: 'solid',
        label: tool.kind === 'sector' ? 'r = 14 cm' : 'Arc AB',
      });
      return;
    }
    onAddElement({
      id,
      kind: 'line',
      lineKind: tool.kind,
      x1: 140,
      y1: tool.kind === 'diagonal' ? 210 : 160,
      x2: 360,
      y2: tool.kind === 'diagonal' ? 100 : 160,
      strokeColor: '#0f172a',
      strokeWidth: 2.5,
      lineStyle: tool.style || 'solid',
      arrowStart: tool.arrowStart,
      arrowEnd: tool.arrowEnd,
      parallelTicks: tool.kind === 'parallel_pair' ? 1 : 0,
      label:
        tool.kind === 'measurement'
          ? '10 cm'
          : tool.kind === 'radius'
          ? 'r'
          : tool.kind === 'diameter'
          ? 'd'
          : undefined,
    });
  };

  const handleAddAngle = (tool: (typeof ANGLE_TOOLS)[number]) => {
    onAddElement({
      id: makeId('ang'),
      kind: 'angle',
      angleKind: tool.kind,
      cx: 240,
      cy: 190,
      radius: 38,
      startAngleDeg: tool.start,
      sweepAngleDeg: tool.sweep,
      drawRays: tool.kind !== 'arc',
      rayLength: 105,
      rightAngleSquare: tool.rightSquare,
      label: tool.defaultLabel,
      strokeColor: tool.rightSquare ? '#0f172a' : '#b45309',
      strokeWidth: 2,
    });
  };

  const handleAddLabel = () => {
    onAddElement({
      id: makeId('lbl'),
      kind: 'label',
      x: 240,
      y: 160,
      text: 'x cm',
      fontSize: 14,
      color: '#0f172a',
      bold: true,
    });
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-3 text-xs">
      {/* Tool section tabs */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setSection('shapes')}
          className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            section === 'shapes'
              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Shapes className="w-3.5 h-3.5" /> Basic Shapes
        </button>
        <button
          type="button"
          onClick={() => setSection('lines')}
          className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            section === 'lines'
              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Minus className="w-3.5 h-3.5" /> Lines &amp; Circle Tools
        </button>
        <button
          type="button"
          onClick={() => setSection('angles')}
          className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            section === 'angles'
              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Compass className="w-3.5 h-3.5" /> Angles &amp; Labels
        </button>
        <button
          type="button"
          onClick={() => setSection('templates')}
          className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
            section === 'templates'
              ? 'bg-amber-500 text-slate-950'
              : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> 20 Exam Templates
        </button>
      </div>

      {section === 'shapes' && (
        <div className="flex flex-wrap gap-1.5">
          {SHAPE_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              onClick={() => handleAddShape(tool.kind)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/50 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              + {tool.label}
            </button>
          ))}
        </div>
      )}

      {section === 'lines' && (
        <div className="flex flex-wrap gap-1.5">
          {LINE_TOOLS.map((tool, i) => (
            <button
              key={`${tool.kind}-${i}`}
              type="button"
              onClick={() => handleAddLine(tool)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/50 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              + {tool.label}
            </button>
          ))}
        </div>
      )}

      {section === 'angles' && (
        <div className="flex flex-wrap gap-1.5">
          {ANGLE_TOOLS.map((tool) => (
            <button
              key={tool.kind}
              type="button"
              onClick={() => handleAddAngle(tool)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-amber-950/50 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200 transition-colors"
            >
              + {tool.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddLabel}
            className="px-2.5 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 hover:bg-amber-200 border border-amber-300 dark:border-amber-700 font-bold text-amber-900 dark:text-amber-300 transition-colors"
          >
            + Text / Symbol Label
          </button>
        </div>
      )}

      {section === 'templates' && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search templates (Pythagoras, Histogram, Bearings...)"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
              />
            </div>
            {(['All', 'Geometry', 'Angles & Bearings', 'Coordinate Graphs', 'Statistics'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setTemplateCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] ${
                    templateCategory === cat
                      ? 'bg-slate-900 text-white dark:bg-amber-500 dark:text-slate-950'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cat}
                </button>
              )
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => onApplyTemplate(tpl.createSpec())}
                className="text-left p-2.5 rounded-xl bg-white dark:bg-slate-900 hover:border-amber-500 border border-slate-200 dark:border-slate-700 transition-colors space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">
                    {tpl.number}. {tpl.name}
                  </span>
                  <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                    {tpl.levelTag}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-500 line-clamp-2">{tpl.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
