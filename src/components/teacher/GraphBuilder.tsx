import React from 'react';
import type {
  CBTDiagramSpec,
  CoordinateGraphConfig,
  StatisticalChartConfig,
  StatisticalChartType,
} from '../../types/cbtDiagram';
import { compileSafeMathExpression } from '../../lib/diagramValidation';
import { computeHistogramBars } from '../../lib/geometryPrimitives';
import { DIAGRAM_TEMPLATES } from '../../lib/diagramTemplates';
import { DiagramRenderer } from '../common/DiagramRenderer';
import { Plus, Trash2, AlertCircle } from 'lucide-react';

interface GraphBuilderProps {
  spec: CBTDiagramSpec;
  onChange: (nextSpec: CBTDiagramSpec) => void;
}

const DEFAULT_GRAPH: CoordinateGraphConfig = {
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
};

const DEFAULT_CHART: StatisticalChartConfig = {
  chartType: 'bar',
  xAxisLabel: 'Category',
  yAxisLabel: 'Frequency',
  showGrid: true,
  showValues: true,
  showLegend: true,
  categories: [
    { id: 'c1', label: 'Math', value: 18, color: '#2563eb' },
    { id: 'c2', label: 'English', value: 24, color: '#059669' },
    { id: 'c3', label: 'Physics', value: 14, color: '#d97706' },
  ],
  bins: [
    { id: 'b1', min: 0, max: 10, frequency: 10, color: '#0284c7' },
    { id: 'b2', min: 10, max: 20, frequency: 20, color: '#0284c7' },
    { id: 'b3', min: 20, max: 40, frequency: 30, color: '#0369a1' },
  ],
  scatterPoints: [
    { id: 's1', x: 2, y: 4, label: 'A' },
    { id: 's2', x: 4, y: 7, label: 'B' },
    { id: 's3', x: 6, y: 11, label: 'C' },
  ],
};

const PALETTE = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0284c7'];

export const GraphBuilder: React.FC<GraphBuilderProps> = ({ spec, onChange }) => {
  const isChart = spec.mode === 'chart';
  const graph = spec.graph || DEFAULT_GRAPH;
  const chart = spec.chart || DEFAULT_CHART;

  const switchSubMode = (nextMode: 'graph' | 'chart') => {
    if (nextMode === 'graph') {
      onChange({
        ...spec,
        mode: 'graph',
        width: 540,
        height: 360,
        graph: spec.graph || DEFAULT_GRAPH,
      });
    } else {
      onChange({
        ...spec,
        mode: 'chart',
        width: 540,
        height: 340,
        chart: spec.chart || DEFAULT_CHART,
      });
    }
  };

  const updateGraph = (patch: Partial<CoordinateGraphConfig>) => {
    onChange({
      ...spec,
      mode: 'graph',
      graph: { ...graph, ...patch },
    });
  };

  const updateChart = (patch: Partial<StatisticalChartConfig>) => {
    onChange({
      ...spec,
      mode: 'chart',
      chart: { ...chart, ...patch },
    });
  };

  const graphTemplates = DIAGRAM_TEMPLATES.filter(
    (t) => t.category === 'Coordinate Graphs' || t.category === 'Statistics'
  );

  const histPreview =
    isChart && chart.chartType === 'histogram'
      ? computeHistogramBars(chart.bins || [])
      : null;

  return (
    <div className="space-y-4 text-xs">
      {/* Sub-mode switcher + quick graph templates */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => switchSubMode('graph')}
            className={`px-3 py-1.5 rounded-lg font-bold ${
              !isChart
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Coordinate Plane &amp; Equations
          </button>
          <button
            type="button"
            onClick={() => switchSubMode('chart')}
            className={`px-3 py-1.5 rounded-lg font-bold ${
              isChart
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Statistical Charts (Bar, Histogram, Pie...)
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {graphTemplates.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => onChange(tpl.createSpec())}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 hover:border-amber-500 border border-slate-200 dark:border-slate-700 font-semibold text-[11px]"
            >
              {tpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Editor Grid + Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-6 space-y-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1">Title (optional)</label>
              <input
                type="text"
                value={spec.title || ''}
                onChange={(e) => onChange({ ...spec, title: e.target.value })}
                placeholder="e.g. Graph of y = 2x + 3"
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              />
            </div>
            <div className="flex items-end pb-1.5">
              <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(spec.notDrawnToScale)}
                  onChange={(e) => onChange({ ...spec, notDrawnToScale: e.target.checked })}
                  className="accent-amber-500"
                />
                Show "Not drawn to scale"
              </label>
            </div>
          </div>

          {!isChart ? (
            <div className="space-y-4">
              {/* Coordinate Bounds */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">x Min</label>
                  <input
                    type="number"
                    value={graph.xMin}
                    onChange={(e) => updateGraph({ xMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">x Max</label>
                  <input
                    type="number"
                    value={graph.xMax}
                    onChange={(e) => updateGraph({ xMax: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">x Step</label>
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={graph.xStep}
                    onChange={(e) => updateGraph({ xStep: Math.max(0.1, Number(e.target.value) || 1) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">y Min</label>
                  <input
                    type="number"
                    value={graph.yMin}
                    onChange={(e) => updateGraph({ yMin: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">y Max</label>
                  <input
                    type="number"
                    value={graph.yMax}
                    onChange={(e) => updateGraph({ yMax: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">y Step</label>
                  <input
                    type="number"
                    min={0.1}
                    step="any"
                    value={graph.yStep}
                    onChange={(e) => updateGraph({ yStep: Math.max(0.1, Number(e.target.value) || 1) })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">x-Axis Label</label>
                  <input
                    type="text"
                    value={graph.xLabel || ''}
                    onChange={(e) => updateGraph({ xLabel: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">y-Axis Label</label>
                  <input
                    type="text"
                    value={graph.yLabel || ''}
                    onChange={(e) => updateGraph({ yLabel: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={graph.showGrid}
                    onChange={(e) => updateGraph({ showGrid: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Grid Lines
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={graph.showOriginLabel}
                    onChange={(e) => updateGraph({ showOriginLabel: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Origin Label (O)
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={graph.connectPoints}
                    onChange={(e) => updateGraph({ connectPoints: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Connect Points
                </label>
              </div>

              {/* Equations */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">
                    Equations (e.g. y = 2x + 3, y = x² - 4)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateGraph({
                        equations: [
                          ...graph.equations,
                          {
                            id: `eq-${Date.now()}`,
                            expression: 'y = x + 1',
                            label: 'y = x + 1',
                            color: PALETTE[graph.equations.length % PALETTE.length],
                            strokeWidth: 2.5,
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Add Line / Curve
                  </button>
                </div>

                {graph.equations.map((eq, idx) => {
                  const check = compileSafeMathExpression(eq.expression);
                  return (
                    <div key={eq.id} className="space-y-1 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={eq.color}
                          onChange={(e) => {
                            const next = [...graph.equations];
                            next[idx] = { ...eq, color: e.target.value };
                            updateGraph({ equations: next });
                          }}
                          className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={eq.expression}
                          onChange={(e) => {
                            const next = [...graph.equations];
                            next[idx] = {
                              ...eq,
                              expression: e.target.value,
                              label: e.target.value,
                            };
                            updateGraph({ equations: next });
                          }}
                          placeholder="y = 2x + 3"
                          className="flex-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateGraph({
                              equations: graph.equations.filter((item) => item.id !== eq.id),
                            })
                          }
                          className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/60 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {!check.ok && (
                        <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1 font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" /> {check.error}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Plotted Points */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">Coordinate Points</span>
                  <button
                    type="button"
                    onClick={() =>
                      updateGraph({
                        points: [
                          ...graph.points,
                          {
                            id: `pt-${Date.now()}`,
                            x: 1,
                            y: 2,
                            label: String.fromCharCode(65 + (graph.points.length % 26)),
                            color: '#dc2626',
                            showCoordinates: true,
                          },
                        ],
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" /> Plot Point
                  </button>
                </div>

                {graph.points.map((pt, idx) => (
                  <div key={pt.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      value={pt.label || ''}
                      onChange={(e) => {
                        const next = [...graph.points];
                        next[idx] = { ...pt, label: e.target.value };
                        updateGraph({ points: next });
                      }}
                      placeholder="Lbl"
                      className="col-span-2 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                    />
                    <input
                      type="number"
                      step="any"
                      value={pt.x}
                      onChange={(e) => {
                        const next = [...graph.points];
                        next[idx] = { ...pt, x: Number(e.target.value) || 0 };
                        updateGraph({ points: next });
                      }}
                      className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                    />
                    <input
                      type="number"
                      step="any"
                      value={pt.y}
                      onChange={(e) => {
                        const next = [...graph.points];
                        next[idx] = { ...pt, y: Number(e.target.value) || 0 };
                        updateGraph({ points: next });
                      }}
                      className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                    />
                    <label className="col-span-3 inline-flex items-center gap-1 text-[10.5px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={pt.showCoordinates !== false}
                        onChange={(e) => {
                          const next = [...graph.points];
                          next[idx] = { ...pt, showCoordinates: e.target.checked };
                          updateGraph({ points: next });
                        }}
                        className="accent-amber-500"
                      />
                      Coords
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateGraph({ points: graph.points.filter((p) => p.id !== pt.id) })
                      }
                      className="col-span-1 text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* STATISTICAL CHART EDITOR */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Chart Type</label>
                  <select
                    value={chart.chartType}
                    onChange={(e) =>
                      updateChart({ chartType: e.target.value as StatisticalChartType })
                    }
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold"
                  >
                    <option value="bar">Bar Chart</option>
                    <option value="histogram">Histogram</option>
                    <option value="pie">Pie Chart</option>
                    <option value="line">Line Graph</option>
                    <option value="frequency_polygon">Frequency Polygon</option>
                    <option value="scatter">Scatter Plot</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">X-Axis Label</label>
                  <input
                    type="text"
                    value={chart.xAxisLabel || ''}
                    onChange={(e) => updateChart({ xAxisLabel: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Y-Axis Label</label>
                  <input
                    type="text"
                    value={chart.yAxisLabel || ''}
                    onChange={(e) => updateChart({ yAxisLabel: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chart.showGrid !== false}
                    onChange={(e) => updateChart({ showGrid: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Grid
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chart.showValues !== false}
                    onChange={(e) => updateChart({ showValues: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Show Values
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chart.showLegend !== false}
                    onChange={(e) => updateChart({ showLegend: e.target.checked })}
                    className="accent-amber-500"
                  />
                  Show Legend
                </label>
              </div>

              {/* Data Entry Table */}
              {(chart.chartType === 'bar' ||
                chart.chartType === 'pie' ||
                chart.chartType === 'line') && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Categories &amp; Values</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = chart.categories || [];
                        updateChart({
                          categories: [
                            ...list,
                            {
                              id: `cat-${Date.now()}`,
                              label: `Item ${list.length + 1}`,
                              value: 10,
                              color: PALETTE[list.length % PALETTE.length],
                            },
                          ],
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Row
                    </button>
                  </div>
                  {(chart.categories || []).map((cat, idx) => (
                    <div key={cat.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="color"
                        value={cat.color}
                        onChange={(e) => {
                          const next = [...(chart.categories || [])];
                          next[idx] = { ...cat, color: e.target.value };
                          updateChart({ categories: next });
                        }}
                        className="col-span-1 w-7 h-7 rounded cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={cat.label}
                        onChange={(e) => {
                          const next = [...(chart.categories || [])];
                          next[idx] = { ...cat, label: e.target.value };
                          updateChart({ categories: next });
                        }}
                        className="col-span-6 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      />
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={cat.value}
                        onChange={(e) => {
                          const next = [...(chart.categories || [])];
                          next[idx] = { ...cat, value: Math.max(0, Number(e.target.value) || 0) };
                          updateChart({ categories: next });
                        }}
                        className="col-span-4 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateChart({
                            categories: (chart.categories || []).filter((c) => c.id !== cat.id),
                          })
                        }
                        className="col-span-1 text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(chart.chartType === 'histogram' || chart.chartType === 'frequency_polygon') && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold">Class Intervals</span>
                      {histPreview?.hasUnequalWidths && (
                        <p className="text-[10.5px] text-amber-600 dark:text-amber-400 font-semibold">
                          Unequal class widths detected — rendering Frequency Density (f / width)
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const list = chart.bins || [];
                        const lastMax = list.length > 0 ? list[list.length - 1].max : 0;
                        updateChart({
                          bins: [
                            ...list,
                            {
                              id: `bin-${Date.now()}`,
                              min: lastMax,
                              max: lastMax + 10,
                              frequency: 10,
                              color: '#0284c7',
                            },
                          ],
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Interval
                    </button>
                  </div>
                  {(chart.bins || []).map((b, idx) => {
                    const width = Math.max(0.0001, b.max - b.min);
                    const density = Number((b.frequency / width).toFixed(2));
                    return (
                      <div key={b.id} className="grid grid-cols-12 gap-1.5 items-center">
                        <input
                          type="number"
                          step="any"
                          value={b.min}
                          onChange={(e) => {
                            const next = [...(chart.bins || [])];
                            next[idx] = { ...b, min: Number(e.target.value) || 0 };
                            updateChart({ bins: next });
                          }}
                          placeholder="Min"
                          className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                        />
                        <input
                          type="number"
                          step="any"
                          value={b.max}
                          onChange={(e) => {
                            const next = [...(chart.bins || [])];
                            next[idx] = { ...b, max: Number(e.target.value) || 1 };
                            updateChart({ bins: next });
                          }}
                          placeholder="Max"
                          className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                        />
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={b.frequency}
                          onChange={(e) => {
                            const next = [...(chart.bins || [])];
                            next[idx] = { ...b, frequency: Math.max(0, Number(e.target.value) || 0) };
                            updateChart({ bins: next });
                          }}
                          placeholder="Freq"
                          className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                        />
                        <span className="col-span-2 text-[10px] font-mono tabular-nums text-slate-500">
                          FD:{density}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateChart({ bins: (chart.bins || []).filter((item) => item.id !== b.id) })
                          }
                          className="col-span-1 text-red-500 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {chart.chartType === 'scatter' && (
                <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-bold">Scatter Plot Points (x, y)</span>
                    <button
                      type="button"
                      onClick={() => {
                        const list = chart.scatterPoints || [];
                        updateChart({
                          scatterPoints: [
                            ...list,
                            { id: `sp-${Date.now()}`, x: list.length + 1, y: (list.length + 1) * 2 },
                          ],
                        });
                      }}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Point
                    </button>
                  </div>
                  {(chart.scatterPoints || []).map((pt, idx) => (
                    <div key={pt.id} className="grid grid-cols-12 gap-1.5 items-center">
                      <input
                        type="number"
                        step="any"
                        value={pt.x}
                        onChange={(e) => {
                          const next = [...(chart.scatterPoints || [])];
                          next[idx] = { ...pt, x: Number(e.target.value) || 0 };
                          updateChart({ scatterPoints: next });
                        }}
                        className="col-span-4 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                      />
                      <input
                        type="number"
                        step="any"
                        value={pt.y}
                        onChange={(e) => {
                          const next = [...(chart.scatterPoints || [])];
                          next[idx] = { ...pt, y: Number(e.target.value) || 0 };
                          updateChart({ scatterPoints: next });
                        }}
                        className="col-span-4 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                      />
                      <input
                        type="text"
                        value={pt.label || ''}
                        onChange={(e) => {
                          const next = [...(chart.scatterPoints || [])];
                          next[idx] = { ...pt, label: e.target.value };
                          updateChart({ scatterPoints: next });
                        }}
                        placeholder="Label"
                        className="col-span-3 px-2 py-1 rounded bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateChart({
                            scatterPoints: (chart.scatterPoints || []).filter((s) => s.id !== pt.id),
                          })
                        }
                        className="col-span-1 text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Graph/Chart Preview */}
        <div className="lg:col-span-6 space-y-2">
          <p className="font-bold text-slate-700 dark:text-slate-300">Live Graph / Chart Preview</p>
          <DiagramRenderer
            spec={isChart ? { ...spec, mode: 'chart', chart } : { ...spec, mode: 'graph', graph }}
            interactiveZoom={true}
            maxWidth={700}
            className="my-0"
          />
        </div>
      </div>
    </div>
  );
};
