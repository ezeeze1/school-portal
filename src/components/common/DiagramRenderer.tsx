import React, { useId, useMemo, useState, useEffect } from 'react';
import type {
  CBTDiagramSpec,
  CoordinateGraphConfig,
  GeometryAngleElement,
  GeometryElement,
  GeometryLabelElement,
  GeometryLineElement,
  GeometryShapeElement,
  StatisticalChartConfig,
} from '../../types/cbtDiagram';
import {
  buildRightAngleSquarePoints,
  buildSemicirclePath,
  buildSvgArcPath,
  computeHistogramBars,
  degToRad,
  getAngleLabelPosition,
  getLineLabelPosition,
  getLineStrokeDashArray,
  getShapeVertices,
} from '../../lib/geometryPrimitives';
import { compileSafeMathExpression } from '../../lib/diagramValidation';
import { AlertTriangle, Maximize2, X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface DiagramRendererProps {
  spec?: CBTDiagramSpec | null;
  error?: string;
  compact?: boolean;
  interactiveZoom?: boolean;
  maxWidth?: number;
  className?: string;
  showTitle?: boolean;
}

const HALO_TEXT_STYLE: React.CSSProperties = {
  paintOrder: 'stroke',
  stroke: '#ffffff',
  strokeWidth: 4,
  strokeLinejoin: 'round',
};

function computeNiceTicks(min: number, max: number, step: number, maxCount = 24): number[] {
  const safeStep = step > 0 ? step : (max - min) / 6 || 1;
  const ticks: number[] = [];
  const startIdx = Math.ceil((min - 1e-9) / safeStep);
  const endIdx = Math.floor((max + 1e-9) / safeStep);
  const count = endIdx - startIdx + 1;
  const effectiveStep = count > maxCount ? safeStep * Math.ceil(count / maxCount) : safeStep;

  const first = Math.ceil((min - 1e-9) / effectiveStep) * effectiveStep;
  for (let v = first; v <= max + 1e-9 && ticks.length <= maxCount + 2; v += effectiveStep) {
    const rounded = Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(4));
    ticks.push(rounded);
  }
  return ticks;
}

const GeometrySvgContent: React.FC<{
  elements: GeometryElement[];
  width: number;
  height: number;
  gridEnabled?: boolean;
  gridSize?: number;
  uid: string;
}> = ({ elements, width, height, gridEnabled, gridSize = 20, uid }) => {
  const arrowStartId = `${uid}-arrow-start`;
  const arrowEndId = `${uid}-arrow-end`;

  const gridLines = useMemo(() => {
    if (!gridEnabled) return null;
    const step = Math.max(10, Math.min(80, gridSize));
    const vLines: number[] = [];
    const hLines: number[] = [];
    for (let x = step; x < width; x += step) vLines.push(x);
    for (let y = step; y < height; y += step) hLines.push(y);
    return { vLines, hLines };
  }, [gridEnabled, gridSize, width, height]);

  const renderShape = (el: GeometryShapeElement) => {
    const fill = el.fillTransparent ? 'none' : el.fillColor || '#e0f2fe';
    const dash = getLineStrokeDashArray(el.lineStyle);
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const rotTransform = el.rotation ? `rotate(${el.rotation} ${cx} ${cy})` : undefined;

    if (el.shapeKind === 'circle' || el.shapeKind === 'ellipse') {
      const rx = el.width / 2;
      const ry = el.shapeKind === 'circle' ? Math.min(el.width, el.height) / 2 : el.height / 2;
      return (
        <g key={el.id} transform={rotTransform}>
          <ellipse
            cx={cx}
            cy={cy}
            rx={rx}
            ry={ry}
            fill={fill}
            fillOpacity={el.fillTransparent ? 0 : 0.72}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
          />
          <circle cx={cx} cy={cy} r={2.5} fill={el.strokeColor} />
          {!el.hideMeasurement && el.sideLabels?.['0'] && (
            <text
              x={cx}
              y={cy - ry - 10}
              textAnchor="middle"
              fontSize={12.5}
              fontWeight={600}
              fill="#0f172a"
              style={HALO_TEXT_STYLE}
            >
              {el.sideLabels['0']}
            </text>
          )}
        </g>
      );
    }

    if (el.shapeKind === 'semicircle') {
      return (
        <g key={el.id} transform={rotTransform}>
          <path
            d={buildSemicirclePath(el)}
            fill={fill}
            fillOpacity={el.fillTransparent ? 0 : 0.72}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
          />
          {!el.hideMeasurement && el.sideLabels?.['0'] && (
            <text
              x={cx}
              y={el.y + el.height + 16}
              textAnchor="middle"
              fontSize={12.5}
              fontWeight={600}
              fill="#0f172a"
              style={HALO_TEXT_STYLE}
            >
              {el.sideLabels['0']}
            </text>
          )}
        </g>
      );
    }

    const pts = getShapeVertices(el);
    if (pts.length < 3) return null;
    const pointsAttr = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const centroid = {
      x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
      y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
    };

    const showEqualTicksOnAll =
      el.shapeKind === 'square' ||
      el.shapeKind === 'equilateral_triangle' ||
      el.shapeKind === 'rhombus';

    return (
      <g key={el.id}>
        <polygon
          points={pointsAttr}
          fill={fill}
          fillOpacity={el.fillTransparent ? 0 : 0.72}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
          strokeDasharray={dash}
          strokeLinejoin="round"
        />

        {/* Right angle box on specified corner or standard right_triangle */}
        {(() => {
          const cornerIdx =
            el.rightAngleCorner !== undefined
              ? el.rightAngleCorner
              : el.shapeKind === 'right_triangle'
              ? 2
              : undefined;
          if (cornerIdx === undefined || cornerIdx < 0 || cornerIdx >= pts.length) return null;
          const prev = pts[(cornerIdx - 1 + pts.length) % pts.length];
          const curr = pts[cornerIdx];
          const next = pts[(cornerIdx + 1) % pts.length];
          return (
            <polyline
              points={buildRightAngleSquarePoints(curr, prev, next, 13)}
              fill="none"
              stroke={el.strokeColor}
              strokeWidth={1.6}
            />
          );
        })()}

        {/* Equal-side ticks or parallel ticks */}
        {pts.map((p1, idx) => {
          const p2 = pts[(idx + 1) % pts.length];
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;

          const drawEqualTick =
            showEqualTicksOnAll ||
            (el.shapeKind === 'isosceles_triangle' && (idx === 0 || idx === 2));

          return (
            <React.Fragment key={`edge-${idx}`}>
              {drawEqualTick && (
                <line
                  x1={mx - nx * 5}
                  y1={my - ny * 5}
                  x2={mx + nx * 5}
                  y2={my + ny * 5}
                  stroke={el.strokeColor}
                  strokeWidth={1.6}
                />
              )}
              {!el.hideMeasurement && el.sideLabels?.[String(idx)] && (() => {
                // Push label outward from centroid
                const vx = mx - centroid.x;
                const vy = my - centroid.y;
                const vLen = Math.hypot(vx, vy) || 1;
                const lx = mx + (vx / vLen) * 16;
                const ly = my + (vy / vLen) * 16 + 4;
                return (
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    fontSize={12.5}
                    fontWeight={600}
                    fill="#0f172a"
                    style={HALO_TEXT_STYLE}
                  >
                    {el.sideLabels[String(idx)]}
                  </text>
                );
              })()}
            </React.Fragment>
          );
        })}

        {/* Vertex Labels */}
        {el.vertexLabels?.map((lbl, idx) => {
          if (!lbl || idx >= pts.length) return null;
          const p = pts[idx];
          const vx = p.x - centroid.x;
          const vy = p.y - centroid.y;
          const vLen = Math.hypot(vx, vy) || 1;
          const lx = p.x + (vx / vLen) * 14;
          const ly = p.y + (vy / vLen) * 14 + 4;
          return (
            <text
              key={`v-${idx}`}
              x={lx}
              y={ly}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#0f172a"
              style={HALO_TEXT_STYLE}
            >
              {lbl}
            </text>
          );
        })}
      </g>
    );
  };

  const renderLine = (el: GeometryLineElement) => {
    const dash = getLineStrokeDashArray(el.lineStyle);

    if (el.lineKind === 'arc' || el.lineKind === 'sector') {
      const r = el.radius ?? (Math.hypot(el.x2 - el.x1, el.y2 - el.y1) || 70);
      const startDeg = el.startAngleDeg ?? -60;
      const endDeg = el.endAngleDeg ?? 0;
      const isSector = el.lineKind === 'sector';
      const d = buildSvgArcPath(el.x1, el.y1, r, startDeg, endDeg, isSector);
      const labelPos = getLineLabelPosition(el);
      return (
        <g key={el.id}>
          <path
            d={d}
            fill={isSector && !el.fillTransparent ? el.fillColor || '#fde68a' : 'none'}
            fillOpacity={isSector && !el.fillTransparent ? 0.65 : 0}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
            strokeLinejoin="round"
          />
          {!el.hideMeasurement && el.label && (
            <text
              x={labelPos.x}
              y={labelPos.y + 4}
              textAnchor="middle"
              fontSize={12.5}
              fontWeight={600}
              fill="#0f172a"
              style={HALO_TEXT_STYLE}
            >
              {el.label}
            </text>
          )}
        </g>
      );
    }

    if (el.lineKind === 'parallel_pair') {
      const dx = el.x2 - el.x1;
      const dy = el.y2 - el.y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * 28;
      const ny = (dx / len) * 28;
      const mx1 = (el.x1 + el.x2) / 2;
      const my1 = (el.y1 + el.y2) / 2;
      const mx2 = mx1 + nx;
      const my2 = my1 + ny;
      const ux = dx / len;
      const uy = dy / len;

      return (
        <g key={el.id}>
          <line
            x1={el.x1}
            y1={el.y1}
            x2={el.x2}
            y2={el.y2}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
            markerStart={el.arrowStart ? `url(#${arrowStartId})` : undefined}
            markerEnd={el.arrowEnd ? `url(#${arrowEndId})` : undefined}
          />
          <line
            x1={el.x1 + nx}
            y1={el.y1 + ny}
            x2={el.x2 + nx}
            y2={el.y2 + ny}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
            markerStart={el.arrowStart ? `url(#${arrowStartId})` : undefined}
            markerEnd={el.arrowEnd ? `url(#${arrowEndId})` : undefined}
          />
          {[
            { x: mx1, y: my1 },
            { x: mx2, y: my2 },
          ].map((m, i) => (
            <polyline
              key={i}
              points={`${m.x - ux * 6 - uy * 5},${m.y - uy * 6 + ux * 5} ${m.x + ux * 2},${m.y + uy * 2} ${m.x - ux * 6 + uy * 5},${m.y - uy * 6 - ux * 5}`}
              fill="none"
              stroke={el.strokeColor}
              strokeWidth={1.6}
            />
          ))}
        </g>
      );
    }

    if (el.lineKind === 'perpendicular_pair') {
      const mx = (el.x1 + el.x2) / 2;
      const my = el.y2;
      const topY = Math.min(el.y1, el.y2) - 45;
      return (
        <g key={el.id}>
          <line
            x1={el.x1}
            y1={my}
            x2={el.x2}
            y2={my}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
          />
          <line
            x1={mx}
            y1={my}
            x2={mx}
            y2={topY}
            stroke={el.strokeColor}
            strokeWidth={el.strokeWidth}
            strokeDasharray={dash}
          />
          <polyline
            points={`${mx},${my - 14} ${mx + 14},${my - 14} ${mx + 14},${my}`}
            fill="none"
            stroke={el.strokeColor}
            strokeWidth={1.6}
          />
        </g>
      );
    }

    const mx = (el.x1 + el.x2) / 2;
    const my = (el.y1 + el.y2) / 2;
    const dx = el.x2 - el.x1;
    const dy = el.y2 - el.y1;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const labelPos = getLineLabelPosition(el);

    return (
      <g key={el.id}>
        <line
          x1={el.x1}
          y1={el.y1}
          x2={el.x2}
          y2={el.y2}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
          strokeDasharray={dash}
          markerStart={el.arrowStart ? `url(#${arrowStartId})` : undefined}
          markerEnd={el.arrowEnd ? `url(#${arrowEndId})` : undefined}
        />

        {/* Parallel arrow chevron ticks */}
        {el.parallelTicks &&
          el.parallelTicks > 0 &&
          Array.from({ length: el.parallelTicks }, (_, k) => {
            const offset = (k - (el.parallelTicks! - 1) / 2) * 7;
            const px = mx + ux * offset;
            const py = my + uy * offset;
            return (
              <polyline
                key={k}
                points={`${px - ux * 5 - uy * 5},${py - uy * 5 + ux * 5} ${px + ux * 2},${py + uy * 2} ${px - ux * 5 + uy * 5},${py - uy * 5 - ux * 5}`}
                fill="none"
                stroke={el.strokeColor}
                strokeWidth={1.6}
              />
            );
          })}

        {/* Equal-length tick marks */}
        {el.equalTicks &&
          el.equalTicks > 0 &&
          Array.from({ length: el.equalTicks }, (_, k) => {
            const offset = (k - (el.equalTicks! - 1) / 2) * 6;
            const px = mx + ux * offset;
            const py = my + uy * offset;
            return (
              <line
                key={k}
                x1={px - nx * 6}
                y1={py - ny * 6}
                x2={px + nx * 6}
                y2={py + ny * 6}
                stroke={el.strokeColor}
                strokeWidth={1.6}
              />
            );
          })}

        {!el.hideMeasurement && el.label && (
          <text
            x={labelPos.x}
            y={labelPos.y + 4}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={600}
            fill={el.strokeColor === '#94a3b8' ? '#0f172a' : el.strokeColor}
            style={HALO_TEXT_STYLE}
          >
            {el.label}
          </text>
        )}
      </g>
    );
  };

  const renderAngle = (el: GeometryAngleElement) => {
    const rayLen = el.rayLength ?? Math.max(70, el.radius + 55);
    const sRad = degToRad(el.startAngleDeg);
    const eRad = degToRad(el.startAngleDeg + el.sweepAngleDeg);

    const ray1End = {
      x: el.cx + rayLen * Math.cos(sRad),
      y: el.cy + rayLen * Math.sin(sRad),
    };
    const ray2End = {
      x: el.cx + rayLen * Math.cos(eRad),
      y: el.cy + rayLen * Math.sin(eRad),
    };

    const isRightSquare = el.rightAngleSquare || el.angleKind === 'right';
    const sqSize = Math.min(18, Math.max(10, el.radius * 0.65));

    const sqP1 = {
      x: el.cx + sqSize * Math.cos(sRad),
      y: el.cy + sqSize * Math.sin(sRad),
    };
    const sqP3 = {
      x: el.cx + sqSize * Math.cos(eRad),
      y: el.cy + sqSize * Math.sin(eRad),
    };
    const sqP2 = {
      x: sqP1.x + sqSize * Math.cos(eRad),
      y: sqP1.y + sqSize * Math.sin(eRad),
    };

    const arcD = buildSvgArcPath(
      el.cx,
      el.cy,
      el.radius,
      el.startAngleDeg,
      el.startAngleDeg + el.sweepAngleDeg,
      false
    );
    const sectorFillD = buildSvgArcPath(
      el.cx,
      el.cy,
      el.radius,
      el.startAngleDeg,
      el.startAngleDeg + el.sweepAngleDeg,
      true
    );

    const lblPos = getAngleLabelPosition(el);
    const displayLabel = el.label
      ? el.showDegreeSymbol && !el.label.includes('°')
        ? `${el.label}°`
        : el.label
      : '';

    return (
      <g key={el.id}>
        {el.drawRays && (
          <>
            <line
              x1={el.cx}
              y1={el.cy}
              x2={ray1End.x}
              y2={ray1End.y}
              stroke="#0f172a"
              strokeWidth={2}
              markerEnd={`url(#${arrowEndId})`}
            />
            <line
              x1={el.cx}
              y1={el.cy}
              x2={ray2End.x}
              y2={ray2End.y}
              stroke="#0f172a"
              strokeWidth={2}
              markerEnd={`url(#${arrowEndId})`}
            />
          </>
        )}

        {isRightSquare ? (
          <polyline
            points={`${sqP1.x.toFixed(1)},${sqP1.y.toFixed(1)} ${sqP2.x.toFixed(1)},${sqP2.y.toFixed(1)} ${sqP3.x.toFixed(1)},${sqP3.y.toFixed(1)}`}
            fill="none"
            stroke={el.strokeColor || '#0f172a'}
            strokeWidth={el.strokeWidth || 1.8}
          />
        ) : (
          <>
            <path d={sectorFillD} fill={el.fillColor || el.strokeColor} fillOpacity={0.12} stroke="none" />
            <path
              d={arcD}
              fill="none"
              stroke={el.strokeColor || '#b45309'}
              strokeWidth={el.strokeWidth || 2}
            />
          </>
        )}

        {displayLabel && (
          <text
            x={lblPos.x}
            y={lblPos.y + 4}
            textAnchor="middle"
            fontSize={12.5}
            fontWeight={700}
            fill={el.strokeColor || '#b45309'}
            style={HALO_TEXT_STYLE}
          >
            {displayLabel}
          </text>
        )}
      </g>
    );
  };

  const renderLabel = (el: GeometryLabelElement) => (
    <text
      key={el.id}
      x={el.x}
      y={el.y}
      fontSize={el.fontSize || 13}
      fontWeight={el.bold ? 700 : 500}
      fontStyle={el.italic ? 'italic' : 'normal'}
      fill={el.color || '#0f172a'}
      style={HALO_TEXT_STYLE}
    >
      {el.text}
    </text>
  );

  return (
    <>
      <defs>
        <marker
          id={arrowEndId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f172a" />
        </marker>
        <marker
          id={arrowStartId}
          viewBox="0 0 10 10"
          refX="2"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M 10 1 L 0 5 L 10 9 z" fill="#0f172a" />
        </marker>
      </defs>

      {gridLines && (
        <g stroke="#e2e8f0" strokeWidth={0.8}>
          {gridLines.vLines.map((x) => (
            <line key={`gv-${x}`} x1={x} y1={0} x2={x} y2={height} />
          ))}
          {gridLines.hLines.map((y) => (
            <line key={`gh-${y}`} x1={0} y1={y} x2={width} y2={y} />
          ))}
        </g>
      )}

      {elements.map((el) => {
        if (el.kind === 'shape') return renderShape(el);
        if (el.kind === 'line') return renderLine(el);
        if (el.kind === 'angle') return renderAngle(el);
        if (el.kind === 'label') return renderLabel(el);
        return null;
      })}
    </>
  );
};

const CoordinateGraphSvgContent: React.FC<{
  graph: CoordinateGraphConfig;
  width: number;
  height: number;
  uid: string;
}> = ({ graph, width, height, uid }) => {
  const padL = 46;
  const padR = 26;
  const padT = 24;
  const padB = 38;
  const plotW = Math.max(80, width - padL - padR);
  const plotH = Math.max(80, height - padT - padB);
  const clipId = `${uid}-plot-clip`;
  const arrowId = `${uid}-axis-arrow`;

  const xSpan = graph.xMax - graph.xMin || 1;
  const ySpan = graph.yMax - graph.yMin || 1;

  const toPxX = (x: number) => padL + ((x - graph.xMin) / xSpan) * plotW;
  const toPxY = (y: number) => padT + ((graph.yMax - y) / ySpan) * plotH;

  const xTicks = useMemo(
    () => computeNiceTicks(graph.xMin, graph.xMax, graph.xStep),
    [graph.xMin, graph.xMax, graph.xStep]
  );
  const yTicks = useMemo(
    () => computeNiceTicks(graph.yMin, graph.yMax, graph.yStep),
    [graph.yMin, graph.yMax, graph.yStep]
  );

  const zeroXInPlot = graph.xMin <= 0 && graph.xMax >= 0;
  const zeroYInPlot = graph.yMin <= 0 && graph.yMax >= 0;
  const yAxisPx = zeroXInPlot ? toPxX(0) : padL;
  const xAxisPx = zeroYInPlot ? toPxY(0) : padT + plotH;

  const equationPaths = useMemo(() => {
    const sampleCount = 260;
    const jumpThreshold = ySpan * 1.6;
    return graph.equations.map((eq) => {
      const compiled = compileSafeMathExpression(eq.expression);
      if (!compiled.ok || !compiled.evaluate) {
        return { eq, segments: [] as string[] };
      }
      const segments: string[] = [];
      let currentPts: string[] = [];
      let prevY: number | null = null;

      for (let i = 0; i <= sampleCount; i++) {
        const xv = graph.xMin + (i / sampleCount) * xSpan;
        const yv = compiled.evaluate(xv);
        if (yv === null || !Number.isFinite(yv)) {
          if (currentPts.length >= 2) segments.push(currentPts.join(' '));
          currentPts = [];
          prevY = null;
          continue;
        }
        if (prevY !== null && Math.abs(yv - prevY) > jumpThreshold) {
          if (currentPts.length >= 2) segments.push(currentPts.join(' '));
          currentPts = [];
        }
        currentPts.push(`${toPxX(xv).toFixed(2)},${toPxY(yv).toFixed(2)}`);
        prevY = yv;
      }
      if (currentPts.length >= 2) {
        segments.push(currentPts.join(' '));
      }
      return { eq, segments };
    });
  }, [graph.equations, graph.xMin, xSpan, ySpan, plotW, plotH]);

  const connectedPtsStr = useMemo(() => {
    if (!graph.connectPoints || graph.points.length < 2) return '';
    const pts = graph.points.map((p) => `${toPxX(p.x).toFixed(1)},${toPxY(p.y).toFixed(1)}`);
    if (graph.closePolygon && graph.points.length >= 3) {
      pts.push(pts[0]);
    }
    return pts.join(' ');
  }, [graph.connectPoints, graph.closePolygon, graph.points, plotW, plotH]);

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect x={padL} y={padT} width={plotW} height={plotH} />
        </clipPath>
        <marker id={arrowId} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M 0 1 L 10 5 L 0 9 z" fill="#0f172a" />
        </marker>
      </defs>

      {/* Grid lines */}
      {graph.showGrid && (
        <g stroke="#e2e8f0" strokeWidth={0.9}>
          {xTicks.map((xt) => (
            <line key={`gx-${xt}`} x1={toPxX(xt)} y1={padT} x2={toPxX(xt)} y2={padT + plotH} />
          ))}
          {yTicks.map((yt) => (
            <line key={`gy-${yt}`} x1={padL} y1={toPxY(yt)} x2={padL + plotW} y2={toPxY(yt)} />
          ))}
        </g>
      )}

      {/* Plot border box */}
      <rect x={padL} y={padT} width={plotW} height={plotH} fill="none" stroke="#cbd5e1" strokeWidth={1} />

      {/* Axes */}
      <line
        x1={padL}
        y1={xAxisPx}
        x2={padL + plotW + 8}
        y2={xAxisPx}
        stroke="#0f172a"
        strokeWidth={1.6}
        markerEnd={`url(#${arrowId})`}
      />
      <line
        x1={yAxisPx}
        y1={padT + plotH}
        x2={yAxisPx}
        y2={padT - 8}
        stroke="#0f172a"
        strokeWidth={1.6}
        markerEnd={`url(#${arrowId})`}
      />

      {/* Tick marks and numeric labels */}
      {xTicks.map((xt) => {
        if (zeroXInPlot && zeroYInPlot && xt === 0) return null;
        const px = toPxX(xt);
        const labelY = Math.min(padT + plotH + 15, xAxisPx + 15);
        return (
          <g key={`xt-${xt}`}>
            <line x1={px} y1={xAxisPx - 3} x2={px} y2={xAxisPx + 3} stroke="#0f172a" strokeWidth={1.1} />
            <text
              x={px}
              y={labelY}
              textAnchor="middle"
              fontSize={10.5}
              fill="#334155"
              style={HALO_TEXT_STYLE}
            >
              {xt}
            </text>
          </g>
        );
      })}

      {yTicks.map((yt) => {
        if (zeroXInPlot && zeroYInPlot && yt === 0) return null;
        const py = toPxY(yt);
        const labelX = Math.max(padL - 8, yAxisPx - 8);
        return (
          <g key={`yt-${yt}`}>
            <line x1={yAxisPx - 3} y1={py} x2={yAxisPx + 3} y2={py} stroke="#0f172a" strokeWidth={1.1} />
            <text
              x={labelX}
              y={py + 3.5}
              textAnchor="end"
              fontSize={10.5}
              fill="#334155"
              style={HALO_TEXT_STYLE}
            >
              {yt}
            </text>
          </g>
        );
      })}

      {/* Origin Label */}
      {graph.showOriginLabel && zeroXInPlot && zeroYInPlot && (
        <text
          x={yAxisPx - 8}
          y={xAxisPx + 14}
          textAnchor="end"
          fontSize={11}
          fontWeight={700}
          fill="#0f172a"
          style={HALO_TEXT_STYLE}
        >
          O
        </text>
      )}

      {/* Axis Name Labels */}
      <text
        x={padL + plotW + 14}
        y={xAxisPx + 4}
        textAnchor="start"
        fontSize={12}
        fontWeight={700}
        fontStyle="italic"
        fill="#0f172a"
      >
        {graph.xLabel || 'x'}
        {graph.xUnit ? ` (${graph.xUnit})` : ''}
      </text>
      <text
        x={yAxisPx - 6}
        y={padT - 10}
        textAnchor="end"
        fontSize={12}
        fontWeight={700}
        fontStyle="italic"
        fill="#0f172a"
      >
        {graph.yLabel || 'y'}
        {graph.yUnit ? ` (${graph.yUnit})` : ''}
      </text>

      {/* Clipped Curves & Points */}
      <g clipPath={`url(#${clipId})`}>
        {equationPaths.map(({ eq, segments }) =>
          segments.map((pts, idx) => (
            <polyline
              key={`${eq.id}-seg-${idx}`}
              points={pts}
              fill="none"
              stroke={eq.color || '#2563eb'}
              strokeWidth={eq.strokeWidth || 2.5}
              strokeDasharray={eq.dashed ? '6 4' : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))
        )}

        {connectedPtsStr && (
          <polyline
            points={connectedPtsStr}
            fill="none"
            stroke={graph.connectColor || '#059669'}
            strokeWidth={2.2}
          />
        )}

        {graph.points.map((pt) => {
          const px = toPxX(pt.x);
          const py = toPxY(pt.y);
          return (
            <circle
              key={pt.id}
              cx={px}
              cy={py}
              r={4.5}
              fill={pt.color || '#dc2626'}
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}
      </g>

      {/* Point Labels outside clipPath so text near edges stays readable */}
      {graph.points.map((pt) => {
        const px = toPxX(pt.x);
        const py = toPxY(pt.y);
        if (px < padL - 4 || px > padL + plotW + 4 || py < padT - 4 || py > padT + plotH + 4) {
          return null;
        }
        const coordText = pt.showCoordinates ? `(${pt.x}, ${pt.y})` : '';
        const text = [pt.label, coordText].filter(Boolean).join(' ');
        if (!text) return null;
        return (
          <text
            key={`${pt.id}-lbl`}
            x={px + 7}
            y={py - 7}
            fontSize={11}
            fontWeight={700}
            fill={pt.color || '#dc2626'}
            style={HALO_TEXT_STYLE}
          >
            {text}
          </text>
        );
      })}
    </>
  );
};

const StatisticalChartSvgContent: React.FC<{
  chart: StatisticalChartConfig;
  width: number;
  height: number;
}> = ({ chart, width, height }) => {
  const padL = 54;
  const padR = chart.chartType === 'pie' ? 160 : 24;
  const padT = 24;
  const padB = 46;
  const plotW = Math.max(80, width - padL - padR);
  const plotH = Math.max(80, height - padT - padB);

  if (chart.chartType === 'pie') {
    const items = chart.categories || [];
    const total = items.reduce((s, it) => s + Math.max(0, it.value), 0);
    const pieAreaW = chart.showLegend !== false ? width - 175 : width;
    const cx = pieAreaW / 2;
    const cy = height / 2;
    const radius = Math.min(pieAreaW, height) * 0.36;

    if (total <= 0 || items.length === 0) {
      return (
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#64748b">
          Add positive category values to display pie chart
        </text>
      );
    }

    let currentAngle = -90;
    return (
      <>
        {items.map((item) => {
          const sliceDeg = (Math.max(0, item.value) / total) * 360;
          const pct = Math.round((Math.max(0, item.value) / total) * 1000) / 10;
          const startDeg = currentAngle;
          const endDeg = currentAngle + sliceDeg;
          currentAngle = endDeg;

          if (sliceDeg <= 0) return null;

          const midRad = degToRad(startDeg + sliceDeg / 2);
          const lblX = cx + radius * 0.62 * Math.cos(midRad);
          const lblY = cy + radius * 0.62 * Math.sin(midRad);

          return (
            <g key={item.id}>
              {sliceDeg >= 359.9 ? (
                <circle cx={cx} cy={cy} r={radius} fill={item.color} stroke="#ffffff" strokeWidth={2} />
              ) : (
                <path
                  d={buildSvgArcPath(cx, cy, radius, startDeg, endDeg, true)}
                  fill={item.color}
                  stroke="#ffffff"
                  strokeWidth={2}
                />
              )}
              {chart.showValues !== false && sliceDeg >= 18 && (
                <text
                  x={lblX}
                  y={lblY + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill="#ffffff"
                >
                  {pct}%
                </text>
              )}
            </g>
          );
        })}

        {chart.showLegend !== false && (
          <g>
            {items.map((item, idx) => {
              const ly = Math.max(36, cy - (items.length * 24) / 2) + idx * 24;
              const lx = pieAreaW + 8;
              return (
                <g key={`leg-${item.id}`}>
                  <rect x={lx} y={ly - 9} width={12} height={12} rx={3} fill={item.color} />
                  <text x={lx + 18} y={ly + 1} fontSize={11.5} fontWeight={600} fill="#0f172a">
                    {item.label} ({item.value})
                  </text>
                </g>
              );
            })}
          </g>
        )}
      </>
    );
  }

  if (chart.chartType === 'histogram' || chart.chartType === 'frequency_polygon') {
    const bins = [...(chart.bins || [])].sort((a, b) => a.min - b.min);
    if (bins.length === 0) {
      return (
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#64748b">
          Add class intervals to display {chart.chartType === 'histogram' ? 'histogram' : 'frequency polygon'}
        </text>
      );
    }

    const hist = computeHistogramBars(bins);
    const minX = bins[0].min;
    const maxX = bins[bins.length - 1].max;
    const xSpan = maxX - minX || 1;
    const rawMaxY =
      chart.chartType === 'histogram'
        ? Math.max(...hist.bars.map((b) => b.heightMetric), 1)
        : Math.max(...bins.map((b) => b.frequency), 1);
    const maxY = chart.yMax && chart.yMax > 0 ? chart.yMax : rawMaxY * 1.15;
    const stepY = chart.yStep && chart.yStep > 0 ? chart.yStep : Number((maxY / 5).toPrecision(2)) || 1;
    const yTicks = computeNiceTicks(0, maxY, stepY, 8);
    const topYVal = Math.max(maxY, yTicks[yTicks.length - 1] || maxY);

    const toPxX = (x: number) => padL + ((x - minX) / xSpan) * plotW;
    const toPxY = (y: number) => padT + plotH - (y / topYVal) * plotH;

    const boundaries = Array.from(new Set(bins.flatMap((b) => [b.min, b.max]))).sort((a, b) => a - b);
    const effectiveYLabel =
      chart.yAxisLabel ||
      (chart.chartType === 'histogram' ? hist.yLabelDefault : 'Frequency');

    return (
      <>
        {chart.showGrid !== false && (
          <g stroke="#e2e8f0" strokeWidth={0.9}>
            {yTicks.map((yt) => (
              <line key={`hy-${yt}`} x1={padL} y1={toPxY(yt)} x2={padL + plotW} y2={toPxY(yt)} />
            ))}
          </g>
        )}

        {/* Axes */}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />

        {yTicks.map((yt) => (
          <g key={`hyt-${yt}`}>
            <line x1={padL - 4} y1={toPxY(yt)} x2={padL} y2={toPxY(yt)} stroke="#0f172a" strokeWidth={1} />
            <text x={padL - 7} y={toPxY(yt) + 3.5} textAnchor="end" fontSize={10.5} fill="#334155">
              {yt}
            </text>
          </g>
        ))}

        {chart.chartType === 'histogram' ? (
          <>
            {hist.bars.map((bar) => {
              const x1 = toPxX(bar.min);
              const x2 = toPxX(bar.max);
              const barY = toPxY(bar.heightMetric);
              const barH = Math.max(0, padT + plotH - barY);
              return (
                <g key={bar.id}>
                  <rect
                    x={x1}
                    y={barY}
                    width={Math.max(2, x2 - x1)}
                    height={barH}
                    fill={bar.color || '#0284c7'}
                    fillOpacity={0.82}
                    stroke="#0f172a"
                    strokeWidth={1.2}
                  />
                  {chart.showValues !== false && (
                    <text
                      x={(x1 + x2) / 2}
                      y={barY - 5}
                      textAnchor="middle"
                      fontSize={10.5}
                      fontWeight={700}
                      fill="#0f172a"
                      style={HALO_TEXT_STYLE}
                    >
                      {hist.hasUnequalWidths
                        ? `${Number(bar.frequencyDensity.toFixed(2))} (f=${bar.frequency})`
                        : bar.frequency}
                    </text>
                  )}
                </g>
              );
            })}
            {boundaries.map((b) => (
              <text
                key={`bnd-${b}`}
                x={toPxX(b)}
                y={padT + plotH + 15}
                textAnchor="middle"
                fontSize={10.5}
                fill="#334155"
              >
                {b}
              </text>
            ))}
          </>
        ) : (
          <>
            {(() => {
              const pts = bins.map((b) => ({
                mid: (b.min + b.max) / 2,
                freq: b.frequency,
                color: b.color || '#059669',
              }));
              const firstHalf = (bins[0].max - bins[0].min) / 2;
              const lastHalf = (bins[bins.length - 1].max - bins[bins.length - 1].min) / 2;
              const polyCoords = [
                `${toPxX(pts[0].mid - firstHalf * 0.8).toFixed(1)},${toPxY(0).toFixed(1)}`,
                ...pts.map((p) => `${toPxX(p.mid).toFixed(1)},${toPxY(p.freq).toFixed(1)}`),
                `${toPxX(pts[pts.length - 1].mid + lastHalf * 0.8).toFixed(1)},${toPxY(0).toFixed(1)}`,
              ].join(' ');
              return (
                <>
                  <polyline
                    points={polyCoords}
                    fill="none"
                    stroke={chart.accentColor || '#059669'}
                    strokeWidth={2.5}
                  />
                  {pts.map((p, idx) => {
                    const px = toPxX(p.mid);
                    const py = toPxY(p.freq);
                    return (
                      <g key={`fp-${idx}`}>
                        <circle cx={px} cy={py} r={4.5} fill={p.color} stroke="#ffffff" strokeWidth={1.5} />
                        <text x={px} y={padT + plotH + 15} textAnchor="middle" fontSize={10.5} fill="#334155">
                          {p.mid}
                        </text>
                        {chart.showValues !== false && (
                          <text x={px} y={py - 8} textAnchor="middle" fontSize={10.5} fontWeight={700} fill="#0f172a">
                            {p.freq}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </>
              );
            })()}
          </>
        )}

        <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#0f172a">
          {chart.xAxisLabel || (chart.chartType === 'histogram' ? 'Class Boundaries' : 'Class Midpoint')}
        </text>
        <text
          x={14}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize={11.5}
          fontWeight={700}
          fill="#0f172a"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          {effectiveYLabel}
        </text>
      </>
    );
  }

  if (chart.chartType === 'scatter') {
    const pts = chart.scatterPoints || [];
    if (pts.length === 0) {
      return (
        <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#64748b">
          Add (x, y) data points to display scatter plot
        </text>
      );
    }
    const minX = Math.min(0, ...pts.map((p) => p.x));
    const maxX = Math.max(1, ...pts.map((p) => p.x)) * 1.1;
    const minY = Math.min(0, ...pts.map((p) => p.y));
    const maxY = Math.max(1, ...pts.map((p) => p.y)) * 1.15;
    const xTicks = computeNiceTicks(minX, maxX, Number(((maxX - minX) / 5).toPrecision(2)) || 1, 8);
    const yTicks = computeNiceTicks(minY, maxY, Number(((maxY - minY) / 5).toPrecision(2)) || 1, 8);
    const xLo = xTicks[0] ?? minX;
    const xHi = xTicks[xTicks.length - 1] ?? maxX;
    const yLo = yTicks[0] ?? minY;
    const yHi = yTicks[yTicks.length - 1] ?? maxY;
    const toPxX = (x: number) => padL + ((x - xLo) / (xHi - xLo || 1)) * plotW;
    const toPxY = (y: number) => padT + plotH - ((y - yLo) / (yHi - yLo || 1)) * plotH;

    return (
      <>
        {chart.showGrid !== false && (
          <g stroke="#e2e8f0" strokeWidth={0.9}>
            {xTicks.map((xt) => (
              <line key={`sx-${xt}`} x1={toPxX(xt)} y1={padT} x2={toPxX(xt)} y2={padT + plotH} />
            ))}
            {yTicks.map((yt) => (
              <line key={`sy-${yt}`} x1={padL} y1={toPxY(yt)} x2={padL + plotW} y2={toPxY(yt)} />
            ))}
          </g>
        )}
        <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />
        <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />
        {xTicks.map((xt) => (
          <text key={`sxt-${xt}`} x={toPxX(xt)} y={padT + plotH + 15} textAnchor="middle" fontSize={10.5} fill="#334155">
            {xt}
          </text>
        ))}
        {yTicks.map((yt) => (
          <text key={`syt-${yt}`} x={padL - 7} y={toPxY(yt) + 3.5} textAnchor="end" fontSize={10.5} fill="#334155">
            {yt}
          </text>
        ))}
        {pts.map((p) => {
          const px = toPxX(p.x);
          const py = toPxY(p.y);
          return (
            <g key={p.id}>
              <circle cx={px} cy={py} r={4.5} fill={chart.accentColor || '#2563eb'} stroke="#ffffff" strokeWidth={1.5} />
              {p.label && (
                <text x={px + 7} y={py - 6} fontSize={10.5} fontWeight={600} fill="#0f172a" style={HALO_TEXT_STYLE}>
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
        <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#0f172a">
          {chart.xAxisLabel || 'x'}
        </text>
        <text
          x={14}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize={11.5}
          fontWeight={700}
          fill="#0f172a"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          {chart.yAxisLabel || 'y'}
        </text>
      </>
    );
  }

  // Bar & Line charts
  const items = chart.categories || [];
  if (items.length === 0) {
    return (
      <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={12} fill="#64748b">
        Add categories and values to display chart
      </text>
    );
  }

  const rawMax = Math.max(...items.map((i) => i.value), 1);
  const maxY = chart.yMax && chart.yMax > 0 ? chart.yMax : rawMax * 1.15;
  const stepY = chart.yStep && chart.yStep > 0 ? chart.yStep : Math.max(1, Math.ceil(maxY / 5));
  const yTicks = computeNiceTicks(0, maxY, stepY, 8);
  const topVal = Math.max(maxY, yTicks[yTicks.length - 1] || maxY);
  const toPxY = (v: number) => padT + plotH - (v / topVal) * plotH;
  const slotW = plotW / items.length;

  return (
    <>
      {chart.showGrid !== false && (
        <g stroke="#e2e8f0" strokeWidth={0.9}>
          {yTicks.map((yt) => (
            <line key={`by-${yt}`} x1={padL} y1={toPxY(yt)} x2={padL + plotW} y2={toPxY(yt)} />
          ))}
        </g>
      )}
      <line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />
      <line x1={padL} y1={padT + plotH} x2={padL + plotW} y2={padT + plotH} stroke="#0f172a" strokeWidth={1.6} />

      {yTicks.map((yt) => (
        <g key={`byt-${yt}`}>
          <line x1={padL - 4} y1={toPxY(yt)} x2={padL} y2={toPxY(yt)} stroke="#0f172a" strokeWidth={1} />
          <text x={padL - 7} y={toPxY(yt) + 3.5} textAnchor="end" fontSize={10.5} fill="#334155">
            {yt}
          </text>
        </g>
      ))}

      {chart.chartType === 'line' && (
        <polyline
          points={items
            .map((it, idx) => `${(padL + slotW * (idx + 0.5)).toFixed(1)},${toPxY(it.value).toFixed(1)}`)
            .join(' ')}
          fill="none"
          stroke={chart.accentColor || '#2563eb'}
          strokeWidth={2.5}
        />
      )}

      {items.map((it, idx) => {
        const cx = padL + slotW * (idx + 0.5);
        const topY = toPxY(it.value);
        const barW = Math.min(54, slotW * 0.62);
        const barH = Math.max(0, padT + plotH - topY);

        return (
          <g key={it.id}>
            {chart.chartType === 'bar' ? (
              <rect
                x={cx - barW / 2}
                y={topY}
                width={barW}
                height={barH}
                rx={3}
                fill={it.color || '#2563eb'}
                fillOpacity={0.9}
              />
            ) : (
              <circle cx={cx} cy={topY} r={5} fill={it.color || '#2563eb'} stroke="#ffffff" strokeWidth={1.5} />
            )}
            {chart.showValues !== false && (
              <text
                x={cx}
                y={topY - 6}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill="#0f172a"
                style={HALO_TEXT_STYLE}
              >
                {it.value}
              </text>
            )}
            <text
              x={cx}
              y={padT + plotH + 16}
              textAnchor="middle"
              fontSize={10.5}
              fontWeight={600}
              fill="#334155"
            >
              {it.label}
            </text>
          </g>
        );
      })}

      {chart.xAxisLabel && (
        <text x={padL + plotW / 2} y={height - 8} textAnchor="middle" fontSize={11.5} fontWeight={700} fill="#0f172a">
          {chart.xAxisLabel}
        </text>
      )}
      {chart.yAxisLabel && (
        <text
          x={14}
          y={padT + plotH / 2}
          textAnchor="middle"
          fontSize={11.5}
          fontWeight={700}
          fill="#0f172a"
          transform={`rotate(-90 14 ${padT + plotH / 2})`}
        >
          {chart.yAxisLabel}
        </text>
      )}
    </>
  );
};

export const DiagramRenderer: React.FC<DiagramRendererProps> = ({
  spec,
  error,
  compact = false,
  interactiveZoom = true,
  maxWidth,
  className = '',
  showTitle = true,
}) => {
  const uid = useId().replace(/:/g, '');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.4);

  useEffect(() => {
    if (!zoomOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomOpen]);

  if (error || !spec) {
    return (
      <div
        role="alert"
        className={`my-2 p-3 rounded-xl border border-red-300 bg-red-50 text-red-800 text-xs flex items-start gap-2 ${className}`}
      >
        <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Unable to display diagram safely</p>
          {error && <p className="text-[11px] opacity-85 mt-0.5">{error}</p>}
        </div>
      </div>
    );
  }

  const resolvedMaxW = maxWidth ?? (compact ? 260 : 560);

  const renderSvg = (extraProps?: { className?: string }) => (
    <svg
      viewBox={`0 0 ${spec.width} ${spec.height}`}
      className={`w-full h-auto block select-none ${extraProps?.className || ''}`}
      role="img"
      aria-label={spec.title || 'Mathematical diagram'}
    >
      <rect x={0} y={0} width={spec.width} height={spec.height} fill="#ffffff" />
      {spec.mode === 'geometry' && spec.geometry && (
        <GeometrySvgContent
          elements={spec.geometry.elements}
          width={spec.width}
          height={spec.height}
          gridEnabled={spec.gridEnabled}
          gridSize={spec.gridSize}
          uid={uid}
        />
      )}
      {spec.mode === 'graph' && spec.graph && (
        <CoordinateGraphSvgContent
          graph={spec.graph}
          width={spec.width}
          height={spec.height}
          uid={uid}
        />
      )}
      {spec.mode === 'chart' && spec.chart && (
        <StatisticalChartSvgContent
          chart={spec.chart}
          width={spec.width}
          height={spec.height}
        />
      )}
    </svg>
  );

  return (
    <>
      <div
        className={`my-2 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm overflow-hidden ${className}`}
        style={{ maxWidth: `${resolvedMaxW}px` }}
      >
        {showTitle && spec.title && (
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-800 truncate">{spec.title}</span>
          </div>
        )}

        <div
          className={`relative p-2 bg-white ${interactiveZoom ? 'cursor-zoom-in group' : ''}`}
          onClick={(e) => {
            if (!interactiveZoom) return;
            e.stopPropagation();
            setZoomOpen(true);
          }}
        >
          {renderSvg()}

          {interactiveZoom && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Enlarge diagram"
              onClick={(e) => {
                e.stopPropagation();
                setZoomOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  setZoomOpen(true);
                }
              }}
              className="print:hidden absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-[10px] font-semibold opacity-85 group-hover:opacity-100 transition-opacity shadow-sm cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              {!compact && <span>Enlarge</span>}
            </span>
          )}
        </div>

        {(spec.notDrawnToScale || spec.caption || (spec.mode === 'graph' && spec.graph && spec.graph.equations.length > 0)) && (
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <div className="flex flex-wrap items-center gap-3">
              {spec.mode === 'graph' &&
                spec.graph?.equations.map((eq) => (
                  <span key={eq.id} className="inline-flex items-center gap-1.5 font-mono font-semibold text-slate-800">
                    <span
                      className="w-3 h-0.5 inline-block rounded"
                      style={{ backgroundColor: eq.color }}
                    />
                    {eq.label || eq.expression}
                  </span>
                ))}
              {spec.caption && <span>{spec.caption}</span>}
            </div>
            {spec.notDrawnToScale && (
              <span className="italic text-[10.5px] text-slate-500 ml-auto">
                Not drawn to scale
              </span>
            )}
          </div>
        )}
      </div>

      {/* Student & Teacher Read-Only Enlarge / Zoom Modal (No Timer or DB Side Effects) */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={(e) => {
            e.stopPropagation();
            setZoomOpen(false);
          }}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl border border-slate-200 max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50">
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 truncate">
                  {spec.title || 'Enlarged Examination Diagram'}
                </h4>
                <p className="text-[11px] text-slate-500">
                  Pinch or use zoom buttons to inspect measurements clearly.
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.max(0.8, Number((s - 0.25).toFixed(2))))}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  title="Zoom out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold px-2 tabular-nums text-slate-700">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomScale((s) => Math.min(2.5, Number((s + 0.25).toFixed(2))))}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  title="Zoom in"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomScale(1.4)}
                  className="p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700"
                  title="Reset zoom"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoomOpen(false)}
                  className="p-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 ml-1"
                  aria-label="Close enlarged diagram"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1 bg-slate-100 flex items-center justify-center">
              <div
                className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm transition-transform origin-center"
                style={{ width: `${Math.round(540 * zoomScale)}px`, maxWidth: 'none' }}
              >
                {renderSvg()}
                {spec.notDrawnToScale && (
                  <p className="text-right text-[11px] italic text-slate-500 mt-1">
                    Not drawn to scale
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
