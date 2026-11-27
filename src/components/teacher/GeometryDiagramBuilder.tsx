import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CBTDiagramSpec, GeometryElement } from '../../types/cbtDiagram';
import { DiagramRenderer } from '../common/DiagramRenderer';
import { DiagramToolbar } from './DiagramToolbar';
import { DiagramPropertiesPanel } from './DiagramPropertiesPanel';
import { RotateCcw, RotateCw, Trash2, Check, X } from 'lucide-react';

interface GeometryDiagramBuilderProps {
  spec: CBTDiagramSpec;
  onChange: (nextSpec: CBTDiagramSpec) => void;
  onTemplateModeSwitch?: (templateSpec: CBTDiagramSpec) => void;
}

type DragInteraction =
  | {
      type: 'move';
      elementId: string;
      startClientX: number;
      startClientY: number;
      origSnapshot: GeometryElement;
    }
  | {
      type: 'resize';
      elementId: string;
      startClientX: number;
      startClientY: number;
      origSnapshot: GeometryElement;
    }
  | {
      type: 'rotate';
      elementId: string;
      centerX: number;
      centerY: number;
      origSnapshot: GeometryElement;
    };

function getElementBounds(el: GeometryElement): { x: number; y: number; w: number; h: number } {
  if (el.kind === 'shape') {
    return { x: el.x, y: el.y, w: el.width, h: el.height };
  }
  if (el.kind === 'line') {
    if (el.lineKind === 'arc' || el.lineKind === 'sector') {
      const r = el.radius ?? 80;
      return { x: el.x1 - r, y: el.y1 - r, w: r * 2, h: r * 2 };
    }
    const minX = Math.min(el.x1, el.x2);
    const minY = Math.min(el.y1, el.y2);
    const w = Math.max(24, Math.abs(el.x2 - el.x1));
    const h = Math.max(24, Math.abs(el.y2 - el.y1));
    return { x: minX, y: minY, w, h };
  }
  if (el.kind === 'angle') {
    const r = Math.max(32, el.radius);
    return { x: el.cx - r, y: el.cy - r, w: r * 2, h: r * 2 };
  }
  const approxW = Math.max(40, el.text.length * (el.fontSize * 0.6));
  return { x: el.x - 6, y: el.y - el.fontSize, w: approxW, h: el.fontSize + 8 };
}

function hitTestElement(el: GeometryElement, px: number, py: number): boolean {
  const b = getElementBounds(el);
  const pad = 12;
  return px >= b.x - pad && px <= b.x + b.w + pad && py >= b.y - pad && py <= b.y + b.h + pad;
}

export const GeometryDiagramBuilder: React.FC<GeometryDiagramBuilderProps> = ({
  spec,
  onChange,
  onTemplateModeSwitch,
}) => {
  const elements = spec.geometry?.elements || [];
  const [selectedId, setSelectedId] = useState<string | null>(elements[0]?.id ?? null);
  const [historyPast, setHistoryPast] = useState<CBTDiagramSpec[]>([]);
  const [historyFuture, setHistoryFuture] = useState<CBTDiagramSpec[]>([]);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragInteraction | null>(null);
  const specRef = useRef(spec);
  specRef.current = spec;

  const selectedElement = elements.find((e) => e.id === selectedId) || null;

  const commitChange = useCallback(
    (nextSpec: CBTDiagramSpec, recordHistory = true) => {
      if (recordHistory) {
        setHistoryPast((prev) => [...prev.slice(-29), specRef.current]);
        setHistoryFuture([]);
      }
      onChange(nextSpec);
    },
    [onChange]
  );

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const prev = historyPast[historyPast.length - 1];
    setHistoryPast((h) => h.slice(0, -1));
    setHistoryFuture((f) => [specRef.current, ...f.slice(0, 29)]);
    onChange(prev);
  }, [historyPast, onChange]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((f) => f.slice(1));
    setHistoryPast((h) => [...h.slice(-29), specRef.current]);
    onChange(next);
  }, [historyFuture, onChange]);

  const snapVal = (v: number) => {
    if (!spec.snapToGrid) return Math.round(v);
    const step = spec.gridSize || 20;
    return Math.round(v / step) * step;
  };

  const clientToSvgCoords = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
      x: ((clientX - rect.left) / rect.width) * spec.width,
      y: ((clientY - rect.top) / rect.height) * spec.height,
    };
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const pt = clientToSvgCoords(e.clientX, e.clientY);
    // Search top-to-bottom in z-order
    let hit: GeometryElement | null = null;
    for (let i = elements.length - 1; i >= 0; i--) {
      if (hitTestElement(elements[i], pt.x, pt.y)) {
        hit = elements[i];
        break;
      }
    }

    if (!hit) {
      setSelectedId(null);
      return;
    }

    setSelectedId(hit.id);
    setHistoryPast((prev) => [...prev.slice(-29), specRef.current]);
    setHistoryFuture([]);

    dragRef.current = {
      type: 'move',
      elementId: hit.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origSnapshot: JSON.parse(JSON.stringify(hit)),
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleStartResize = (e: React.PointerEvent, el: GeometryElement) => {
    e.stopPropagation();
    setHistoryPast((prev) => [...prev.slice(-29), specRef.current]);
    setHistoryFuture([]);
    dragRef.current = {
      type: 'resize',
      elementId: el.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origSnapshot: JSON.parse(JSON.stringify(el)),
    };
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handleStartRotate = (e: React.PointerEvent, el: GeometryElement) => {
    e.stopPropagation();
    if (el.kind !== 'shape') return;
    setHistoryPast((prev) => [...prev.slice(-29), specRef.current]);
    setHistoryFuture([]);
    dragRef.current = {
      type: 'rotate',
      elementId: el.id,
      centerX: el.x + el.width / 2,
      centerY: el.y + el.height / 2,
      origSnapshot: JSON.parse(JSON.stringify(el)),
    };
    stageRef.current?.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;

    const scaleX = spec.width / rect.width;
    const scaleY = spec.height / rect.height;

    const orig = drag.origSnapshot;
    let updated: GeometryElement = orig;

    if (drag.type === 'move') {
      const dx = (e.clientX - drag.startClientX) * scaleX;
      const dy = (e.clientY - drag.startClientY) * scaleY;
      if (orig.kind === 'shape') {
        updated = { ...orig, x: snapVal(orig.x + dx), y: snapVal(orig.y + dy) };
      } else if (orig.kind === 'line') {
        const sdx = snapVal(orig.x1 + dx) - orig.x1;
        const sdy = snapVal(orig.y1 + dy) - orig.y1;
        updated = {
          ...orig,
          x1: orig.x1 + sdx,
          y1: orig.y1 + sdy,
          x2: orig.x2 + sdx,
          y2: orig.y2 + sdy,
        };
      } else if (orig.kind === 'angle') {
        updated = { ...orig, cx: snapVal(orig.cx + dx), cy: snapVal(orig.cy + dy) };
      } else if (orig.kind === 'label') {
        updated = { ...orig, x: snapVal(orig.x + dx), y: snapVal(orig.y + dy) };
      }
    } else if (drag.type === 'resize') {
      const dx = (e.clientX - drag.startClientX) * scaleX;
      const dy = (e.clientY - drag.startClientY) * scaleY;
      if (orig.kind === 'shape') {
        const nw = Math.max(24, snapVal(orig.width + dx));
        const nh =
          orig.shapeKind === 'square' || orig.shapeKind === 'circle'
            ? nw
            : Math.max(24, snapVal(orig.height + dy));
        updated = { ...orig, width: nw, height: nh };
      } else if (orig.kind === 'line') {
        if (orig.lineKind === 'arc' || orig.lineKind === 'sector') {
          updated = { ...orig, radius: Math.max(20, Math.round((orig.radius ?? 80) + dx)) };
        } else {
          updated = { ...orig, x2: snapVal(orig.x2 + dx), y2: snapVal(orig.y2 + dy) };
        }
      } else if (orig.kind === 'angle') {
        updated = { ...orig, radius: Math.max(16, Math.min(140, Math.round(orig.radius + dx))) };
      }
    } else if (drag.type === 'rotate' && orig.kind === 'shape') {
      const pt = clientToSvgCoords(e.clientX, e.clientY);
      const deg = Math.round(
        (Math.atan2(pt.y - drag.centerY, pt.x - drag.centerX) * 180) / Math.PI + 90
      );
      updated = { ...orig, rotation: deg };
    }

    onChange({
      ...specRef.current,
      geometry: {
        elements: (specRef.current.geometry?.elements || []).map((item) =>
          item.id === drag.elementId ? updated : item
        ),
      },
    });
  };

  const handleCanvasPointerUp = () => {
    dragRef.current = null;
  };

  // Keyboard nudge & undo/redo when canvas focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName;
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      if (!selectedElement) return;
      const step = e.shiftKey ? 10 : 2;
      let dx = 0;
      let dy = 0;
      if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        commitChange({
          ...specRef.current,
          geometry: {
            elements: (specRef.current.geometry?.elements || []).filter(
              (el) => el.id !== selectedElement.id
            ),
          },
        });
        setSelectedId(null);
        return;
      } else {
        return;
      }

      e.preventDefault();
      let moved = selectedElement;
      if (moved.kind === 'shape') moved = { ...moved, x: moved.x + dx, y: moved.y + dy };
      else if (moved.kind === 'line')
        moved = {
          ...moved,
          x1: moved.x1 + dx,
          y1: moved.y1 + dy,
          x2: moved.x2 + dx,
          y2: moved.y2 + dy,
        };
      else if (moved.kind === 'angle') moved = { ...moved, cx: moved.cx + dx, cy: moved.cy + dy };
      else if (moved.kind === 'label') moved = { ...moved, x: moved.x + dx, y: moved.y + dy };

      commitChange({
        ...specRef.current,
        geometry: {
          elements: (specRef.current.geometry?.elements || []).map((el) =>
            el.id === moved.id ? moved : el
          ),
        },
      });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedElement, commitChange, handleUndo, handleRedo]);

  const handleAddElement = (el: GeometryElement) => {
    commitChange({
      ...spec,
      mode: 'geometry',
      geometry: { elements: [...elements, el] },
    });
    setSelectedId(el.id);
  };

  const handleApplyTemplate = (tplSpec: CBTDiagramSpec) => {
    if (tplSpec.mode !== 'geometry' && onTemplateModeSwitch) {
      onTemplateModeSwitch(tplSpec);
      return;
    }
    commitChange(tplSpec);
    setSelectedId(tplSpec.geometry?.elements[0]?.id ?? null);
  };

  const handleUpdateElement = (updated: GeometryElement) => {
    commitChange({
      ...spec,
      geometry: {
        elements: elements.map((el) => (el.id === updated.id ? updated : el)),
      },
    });
  };

  const handleMoveOrder = (direction: 'forward' | 'backward') => {
    if (!selectedId) return;
    const idx = elements.findIndex((e) => e.id === selectedId);
    if (idx === -1) return;
    const targetIdx = direction === 'forward' ? idx + 1 : idx - 1;
    if (targetIdx < 0 || targetIdx >= elements.length) return;
    const copy = [...elements];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    commitChange({ ...spec, geometry: { elements: copy } });
  };

  const handleDuplicate = () => {
    if (!selectedElement) return;
    const clone: GeometryElement = JSON.parse(JSON.stringify(selectedElement));
    clone.id = `${clone.kind}-dup-${Date.now().toString(36)}`;
    if (clone.kind === 'shape' || clone.kind === 'label') {
      clone.x += 20;
      clone.y += 20;
    } else if (clone.kind === 'line') {
      clone.x1 += 20;
      clone.y1 += 20;
      clone.x2 += 20;
      clone.y2 += 20;
    } else if (clone.kind === 'angle') {
      clone.cx += 20;
      clone.cy += 20;
    }
    handleAddElement(clone);
  };

  const handleDeleteSelected = () => {
    if (!selectedId) return;
    commitChange({
      ...spec,
      geometry: { elements: elements.filter((e) => e.id !== selectedId) },
    });
    setSelectedId(null);
  };

  const selBounds = selectedElement ? getElementBounds(selectedElement) : null;

  return (
    <div className="space-y-3">
      <DiagramToolbar
        onAddElement={handleAddElement}
        onApplyTemplate={handleApplyTemplate}
      />

      {/* Action bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={historyPast.length === 0}
            onClick={handleUndo}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 font-bold inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Undo
          </button>
          <button
            type="button"
            disabled={historyFuture.length === 0}
            onClick={handleRedo}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 disabled:opacity-40 font-bold inline-flex items-center gap-1"
          >
            <RotateCw className="w-3.5 h-3.5" /> Redo
          </button>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Drag to move · Corner handle to resize · Arrow keys to nudge
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!confirmClearOpen ? (
            <button
              type="button"
              onClick={() => setConfirmClearOpen(true)}
              disabled={elements.length === 0}
              className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 disabled:opacity-40 text-red-600 dark:text-red-400 font-bold inline-flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Canvas
            </button>
          ) : (
            <div className="inline-flex items-center gap-1.5 bg-red-50 dark:bg-red-950 border border-red-300 dark:border-red-700 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-red-700 dark:text-red-300">
                Clear all elements?
              </span>
              <button
                type="button"
                onClick={() => {
                  commitChange({ ...spec, geometry: { elements: [] } });
                  setSelectedId(null);
                  setConfirmClearOpen(false);
                }}
                className="p-1 rounded bg-red-600 text-white"
                title="Confirm clear"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="p-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                title="Cancel clear"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Stage + Properties */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 space-y-2">
          <div
            ref={stageRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            onPointerCancel={handleCanvasPointerUp}
            className="relative w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white overflow-hidden touch-none select-none shadow-inner"
          >
            <DiagramRenderer
              spec={spec}
              interactiveZoom={false}
              maxWidth={900}
              className="my-0 border-0 rounded-none shadow-none"
              showTitle={false}
            />

            {/* Interactive SVG Selection Overlay */}
            {selectedElement && selBounds && (
              <svg
                viewBox={`0 0 ${spec.width} ${spec.height}`}
                className="absolute inset-0 w-full h-full pointer-events-none"
              >
                <rect
                  x={selBounds.x - 4}
                  y={selBounds.y - 4}
                  width={selBounds.w + 8}
                  height={selBounds.h + 8}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth={1.8}
                  strokeDasharray="4 3"
                />
                {/* Resize handle */}
                {selectedElement.kind !== 'label' && (
                  <circle
                    cx={
                      selectedElement.kind === 'line' &&
                      selectedElement.lineKind !== 'arc' &&
                      selectedElement.lineKind !== 'sector'
                        ? selectedElement.x2
                        : selBounds.x + selBounds.w + 4
                    }
                    cy={
                      selectedElement.kind === 'line' &&
                      selectedElement.lineKind !== 'arc' &&
                      selectedElement.lineKind !== 'sector'
                        ? selectedElement.y2
                        : selBounds.y + selBounds.h + 4
                    }
                    r={6.5}
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="pointer-events-auto cursor-nwse-resize"
                    onPointerDown={(e) => handleStartResize(e, selectedElement)}
                  />
                )}
                {/* Rotate handle for shapes */}
                {selectedElement.kind === 'shape' && (
                  <circle
                    cx={selBounds.x + selBounds.w / 2}
                    cy={Math.max(12, selBounds.y - 16)}
                    r={6}
                    fill="#2563eb"
                    stroke="#ffffff"
                    strokeWidth={2}
                    className="pointer-events-auto cursor-grab"
                    onPointerDown={(e) => handleStartRotate(e, selectedElement)}
                  />
                )}
              </svg>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <DiagramPropertiesPanel
            spec={spec}
            selectedElement={selectedElement}
            onUpdateCanvas={(patch) => commitChange({ ...spec, ...patch })}
            onUpdateElement={handleUpdateElement}
            onMoveOrder={handleMoveOrder}
            onDuplicateElement={handleDuplicate}
            onDeleteElement={handleDeleteSelected}
          />
        </div>
      </div>
    </div>
  );
};
