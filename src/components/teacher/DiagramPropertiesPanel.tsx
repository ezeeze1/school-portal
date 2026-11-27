import React from 'react';
import type { CBTDiagramSpec, GeometryElement, GeometryUnit } from '../../types/cbtDiagram';
import { ArrowDown, ArrowUp, Copy, Trash2 } from 'lucide-react';

interface DiagramPropertiesPanelProps {
  spec: CBTDiagramSpec;
  selectedElement: GeometryElement | null;
  onUpdateCanvas: (patch: Partial<CBTDiagramSpec>) => void;
  onUpdateElement: (updated: GeometryElement) => void;
  onMoveOrder: (direction: 'forward' | 'backward') => void;
  onDuplicateElement: () => void;
  onDeleteElement: () => void;
}

const COLOR_PRESETS = [
  '#0f172a',
  '#2563eb',
  '#059669',
  '#b45309',
  '#dc2626',
  '#7c3aed',
];

const FILL_PRESETS = [
  '#dbeafe',
  '#fef3c7',
  '#dcfce7',
  '#fce7f3',
  '#e0e7ff',
  '#f1f5f9',
];

const QUICK_MATH_SYMBOLS = ['°', 'π', 'θ', 'x°', 'y°', 'cm', 'cm²', 'm', 'km', '√'];

export const DiagramPropertiesPanel: React.FC<DiagramPropertiesPanelProps> = ({
  spec,
  selectedElement,
  onUpdateCanvas,
  onUpdateElement,
  onMoveOrder,
  onDuplicateElement,
  onDeleteElement,
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-4 text-xs">
      {/* Canvas-Level Controls */}
      <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-slate-800">
        <p className="font-bold text-slate-900 dark:text-white">Diagram Canvas Settings</p>
        <input
          type="text"
          value={spec.title || ''}
          onChange={(e) => onUpdateCanvas({ title: e.target.value })}
          placeholder="Optional diagram title (e.g. Right-Angled Triangle ABC)"
          className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
        />
        <div className="flex flex-wrap gap-3 pt-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(spec.gridEnabled)}
              onChange={(e) => onUpdateCanvas({ gridEnabled: e.target.checked })}
              className="accent-amber-500"
            />
            Show Grid
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(spec.snapToGrid)}
              onChange={(e) => onUpdateCanvas({ snapToGrid: e.target.checked })}
              className="accent-amber-500"
            />
            Snap to Grid
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(spec.notDrawnToScale)}
              onChange={(e) => onUpdateCanvas({ notDrawnToScale: e.target.checked })}
              className="accent-amber-500"
            />
            Not drawn to scale
          </label>
        </div>
      </div>

      {!selectedElement ? (
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Tap or click any shape, line, angle, or label on the canvas to edit its exact measurements, labels, colors, rotation, or layer order.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-amber-600 dark:text-amber-400">
              Selected: {selectedElement.kind.toUpperCase()}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onMoveOrder('backward')}
                title="Send backward"
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onMoveOrder('forward')}
                title="Bring forward"
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onDuplicateElement}
                title="Duplicate element"
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onDeleteElement}
                title="Delete element"
                className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 hover:bg-red-100 text-red-600 dark:text-red-400"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* SHAPE PROPERTIES */}
          {selectedElement.kind === 'shape' && (
            <div className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Width (px)</label>
                  <input
                    type="number"
                    min={20}
                    max={520}
                    value={Math.round(selectedElement.width)}
                    onChange={(e) => {
                      const nextW = Math.max(20, Number(e.target.value) || 20);
                      onUpdateElement({
                        ...selectedElement,
                        width: nextW,
                        height:
                          selectedElement.shapeKind === 'square' ||
                          selectedElement.shapeKind === 'circle'
                            ? nextW
                            : selectedElement.height,
                      });
                    }}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Height (px)</label>
                  <input
                    type="number"
                    min={20}
                    max={400}
                    value={Math.round(selectedElement.height)}
                    onChange={(e) => {
                      const nextH = Math.max(20, Number(e.target.value) || 20);
                      onUpdateElement({
                        ...selectedElement,
                        height: nextH,
                        width:
                          selectedElement.shapeKind === 'square' ||
                          selectedElement.shapeKind === 'circle'
                            ? nextH
                            : selectedElement.width,
                      });
                    }}
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Rotate (°)</label>
                  <input
                    type="number"
                    min={-360}
                    max={360}
                    value={Math.round(selectedElement.rotation || 0)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        rotation: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              </div>

              {selectedElement.shapeKind === 'polygon' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Polygon Sides (3–12)</label>
                  <input
                    type="number"
                    min={3}
                    max={12}
                    value={selectedElement.sides ?? 5}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        sides: Math.max(3, Math.min(12, Number(e.target.value) || 5)),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Vertex Labels (comma-separated, e.g. A, B, C, D)
                </label>
                <input
                  type="text"
                  value={(selectedElement.vertexLabels || []).join(', ')}
                  onChange={(e) =>
                    onUpdateElement({
                      ...selectedElement,
                      vertexLabels: e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .slice(0, 12),
                    })
                  }
                  placeholder="A, B, C, D"
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500">
                  Side Measurement Labels (supports unknown e.g. x cm)
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['0', '1', '2', '3'] as const).map((edgeKey, idx) => (
                    <input
                      key={edgeKey}
                      type="text"
                      value={selectedElement.sideLabels?.[edgeKey] || ''}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          sideLabels: {
                            ...(selectedElement.sideLabels || {}),
                            [edgeKey]: e.target.value,
                          },
                        })
                      }
                      placeholder={`Side ${idx + 1} (e.g. 12 cm)`}
                      className="px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px]"
                    />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Unit</label>
                  <select
                    value={selectedElement.unit || ''}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        unit: e.target.value as GeometryUnit,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="">None</option>
                    <option value="mm">mm</option>
                    <option value="cm">cm</option>
                    <option value="m">m</option>
                    <option value="km">km</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Line Style</label>
                  <select
                    value={selectedElement.lineStyle || 'solid'}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        lineStyle: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.fillTransparent)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        fillTransparent: e.target.checked,
                      })
                    }
                    className="accent-amber-500"
                  />
                  Transparent Fill
                </label>
                <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.hideMeasurement)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        hideMeasurement: e.target.checked,
                      })
                    }
                    className="accent-amber-500"
                  />
                  Hide Side Dimensions
                </label>
              </div>
            </div>
          )}

          {/* LINE PROPERTIES */}
          {selectedElement.kind === 'line' && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Line Measurement / Label (e.g. h = 8 cm, x cm)
                </label>
                <input
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) =>
                    onUpdateElement({ ...selectedElement, label: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              {(selectedElement.lineKind === 'arc' || selectedElement.lineKind === 'sector') && (
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Radius</label>
                    <input
                      type="number"
                      min={15}
                      max={250}
                      value={selectedElement.radius ?? 90}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          radius: Math.max(15, Number(e.target.value) || 90),
                        })
                      }
                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">Start (°)</label>
                    <input
                      type="number"
                      value={selectedElement.startAngleDeg ?? -60}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          startAngleDeg: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500">End (°)</label>
                    <input
                      type="number"
                      value={selectedElement.endAngleDeg ?? 0}
                      onChange={(e) =>
                        onUpdateElement({
                          ...selectedElement,
                          endAngleDeg: Number(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Line Style</label>
                  <select
                    value={selectedElement.lineStyle}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        lineStyle: e.target.value as any,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Stroke Width</label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    step={0.5}
                    value={selectedElement.strokeWidth}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        strokeWidth: Math.max(1, Number(e.target.value) || 2),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.arrowStart)}
                    onChange={(e) =>
                      onUpdateElement({ ...selectedElement, arrowStart: e.target.checked })
                    }
                    className="accent-amber-500"
                  />
                  Start Arrow
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.arrowEnd)}
                    onChange={(e) =>
                      onUpdateElement({ ...selectedElement, arrowEnd: e.target.checked })
                    }
                    className="accent-amber-500"
                  />
                  End Arrow
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.hideMeasurement)}
                    onChange={(e) =>
                      onUpdateElement({ ...selectedElement, hideMeasurement: e.target.checked })
                    }
                    className="accent-amber-500"
                  />
                  Hide Label
                </label>
              </div>
            </div>
          )}

          {/* ANGLE PROPERTIES */}
          {selectedElement.kind === 'angle' && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Angle Display Label (e.g. x°, y°, θ, 65°)
                </label>
                <input
                  type="text"
                  value={selectedElement.label || ''}
                  onChange={(e) =>
                    onUpdateElement({ ...selectedElement, label: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Start (°)</label>
                  <input
                    type="number"
                    value={Math.round(selectedElement.startAngleDeg)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        startAngleDeg: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Sweep (°)</label>
                  <input
                    type="number"
                    min={-355}
                    max={355}
                    value={Math.round(selectedElement.sweepAngleDeg)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        sweepAngleDeg: Number(e.target.value) || 45,
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Arc Radius</label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    value={Math.round(selectedElement.radius)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        radius: Math.max(10, Number(e.target.value) || 34),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 text-[11px] font-semibold">
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.rightAngleSquare)}
                    onChange={(e) =>
                      onUpdateElement({ ...selectedElement, rightAngleSquare: e.target.checked })
                    }
                    className="accent-amber-500"
                  />
                  Right-Angle Square
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.drawRays)}
                    onChange={(e) =>
                      onUpdateElement({ ...selectedElement, drawRays: e.target.checked })
                    }
                    className="accent-amber-500"
                  />
                  Draw Rays
                </label>
                <label className="inline-flex items-center gap-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(selectedElement.hideMeasurement)}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        hideMeasurement: e.target.checked,
                        label: e.target.checked ? 'x°' : selectedElement.label,
                      })
                    }
                    className="accent-amber-500"
                  />
                  Mark Unknown (x°)
                </label>
              </div>
            </div>
          )}

          {/* LABEL PROPERTIES */}
          {selectedElement.kind === 'label' && (
            <div className="space-y-2.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Text / Math Label
                </label>
                <input
                  type="text"
                  value={selectedElement.text}
                  onChange={(e) =>
                    onUpdateElement({ ...selectedElement, text: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {QUICK_MATH_SYMBOLS.map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() =>
                        onUpdateElement({
                          ...selectedElement,
                          text: `${selectedElement.text}${sym}`,
                        })
                      }
                      className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-amber-100 text-[11px] font-bold"
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500">Font Size</label>
                  <input
                    type="number"
                    min={9}
                    max={28}
                    value={selectedElement.fontSize}
                    onChange={(e) =>
                      onUpdateElement({
                        ...selectedElement,
                        fontSize: Math.max(9, Number(e.target.value) || 14),
                      })
                    }
                    className="w-full px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 tabular-nums"
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.bold)}
                      onChange={(e) =>
                        onUpdateElement({ ...selectedElement, bold: e.target.checked })
                      }
                      className="accent-amber-500"
                    />
                    Bold
                  </label>
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedElement.italic)}
                      onChange={(e) =>
                        onUpdateElement({ ...selectedElement, italic: e.target.checked })
                      }
                      className="accent-amber-500"
                    />
                    Italic
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* COLORS */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div>
              <span className="block text-[10px] font-bold text-slate-500 mb-1">Line / Stroke Color</span>
              <div className="flex flex-wrap gap-1.5">
                {COLOR_PRESETS.map((c) => {
                  const activeColor =
                    selectedElement.kind === 'label'
                      ? selectedElement.color
                      : selectedElement.strokeColor;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onUpdateElement(
                          selectedElement.kind === 'label'
                            ? { ...selectedElement, color: c }
                            : { ...selectedElement, strokeColor: c }
                        )
                      }
                      className={`w-6 h-6 rounded-md border-2 ${
                        activeColor === c ? 'border-amber-500 scale-110' : 'border-white dark:border-slate-700'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  );
                })}
              </div>
            </div>

            {selectedElement.kind === 'shape' && !selectedElement.fillTransparent && (
              <div>
                <span className="block text-[10px] font-bold text-slate-500 mb-1">Fill Color</span>
                <div className="flex flex-wrap gap-1.5">
                  {FILL_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() =>
                        onUpdateElement({ ...selectedElement, fillColor: c })
                      }
                      className={`w-6 h-6 rounded-md border-2 ${
                        selectedElement.fillColor === c
                          ? 'border-amber-500 scale-110'
                          : 'border-slate-300 dark:border-slate-700'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
