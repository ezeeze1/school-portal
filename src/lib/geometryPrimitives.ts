import type {
  GeometryAngleElement,
  GeometryLineElement,
  GeometryShapeElement,
} from '../types/cbtDiagram';

export interface Point2D {
  x: number;
  y: number;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function rotatePointAround(pt: Point2D, center: Point2D, angleDeg: number): Point2D {
  if (!angleDeg) return pt;
  const rad = degToRad(angleDeg);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = pt.x - center.x;
  const dy = pt.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function getShapeVertices(shape: GeometryShapeElement): Point2D[] {
  const { x, y, width: w, height: h, shapeKind } = shape;
  const cx = x + w / 2;
  const cy = y + h / 2;
  let pts: Point2D[] = [];

  switch (shapeKind) {
    case 'rectangle':
    case 'square':
      pts = [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      break;
    case 'right_triangle':
      pts = [
        { x, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      break;
    case 'equilateral_triangle': {
      const side = Math.min(w, (h * 2) / Math.sqrt(3));
      const triH = (side * Math.sqrt(3)) / 2;
      const topY = cy - triH / 2;
      const botY = cy + triH / 2;
      pts = [
        { x: cx, y: topY },
        { x: cx + side / 2, y: botY },
        { x: cx - side / 2, y: botY },
      ];
      break;
    }
    case 'triangle':
    case 'isosceles_triangle':
      pts = [
        { x: cx, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      break;
    case 'parallelogram': {
      const skew = (shape.skewRatio ?? 0.22) * w;
      const offset = Math.max(10, Math.min(w * 0.4, Math.abs(skew)));
      pts = [
        { x: x + offset, y },
        { x: x + w, y },
        { x: x + w - offset, y: y + h },
        { x, y: y + h },
      ];
      break;
    }
    case 'trapezium': {
      const topRatio = shape.topRatio ?? 0.56;
      const topW = w * topRatio;
      const margin = (w - topW) / 2;
      pts = [
        { x: x + margin, y },
        { x: x + w - margin, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ];
      break;
    }
    case 'rhombus':
      pts = [
        { x: cx, y },
        { x: x + w, y: cy },
        { x: cx, y: y + h },
        { x, y: cy },
      ];
      break;
    case 'kite':
      pts = [
        { x: cx, y },
        { x: x + w, y: y + h * 0.36 },
        { x: cx, y: y + h },
        { x, y: y + h * 0.36 },
      ];
      break;
    case 'polygon': {
      const n = Math.max(3, Math.min(12, shape.sides ?? 5));
      const rx = w / 2;
      const ry = h / 2;
      pts = Array.from({ length: n }, (_, idx) => {
        const theta = -Math.PI / 2 + (idx * 2 * Math.PI) / n;
        return {
          x: cx + rx * Math.cos(theta),
          y: cy + ry * Math.sin(theta),
        };
      });
      break;
    }
    case 'circle':
    case 'ellipse':
    case 'semicircle':
      pts = [];
      break;
  }

  if (shape.rotation && pts.length > 0) {
    return pts.map((p) => rotatePointAround(p, { x: cx, y: cy }, shape.rotation));
  }
  return pts;
}

export function buildSemicirclePath(shape: GeometryShapeElement): string {
  const { x, y, width: w, height: h } = shape;
  const rx = w / 2;
  const ry = h;
  const cy = y + h;
  // Upper semicircle arch from left to right and chord back
  return `M ${x} ${cy} A ${rx} ${ry} 0 0 1 ${x + w} ${cy} Z`;
}

export function buildSvgArcPath(
  cx: number,
  cy: number,
  radius: number,
  startDeg: number,
  endDeg: number,
  closeSector = false
): string {
  const sweep = endDeg - startDeg;
  const absSweep = Math.abs(sweep);
  if (absSweep >= 359.99) {
    // Full circle path fallback
    return `M ${cx + radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx - radius} ${cy} A ${radius} ${radius} 0 1 1 ${cx + radius} ${cy}`;
  }
  const sRad = degToRad(startDeg);
  const eRad = degToRad(endDeg);
  const x1 = cx + radius * Math.cos(sRad);
  const y1 = cy + radius * Math.sin(sRad);
  const x2 = cx + radius * Math.cos(eRad);
  const y2 = cy + radius * Math.sin(eRad);
  const largeArc = absSweep > 180 ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  if (closeSector) {
    return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
  }
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

export function buildRightAngleSquarePoints(
  vertex: Point2D,
  prevPt: Point2D,
  nextPt: Point2D,
  size = 14
): string {
  const ux = prevPt.x - vertex.x;
  const uy = prevPt.y - vertex.y;
  const uLen = Math.hypot(ux, uy) || 1;
  const vx = nextPt.x - vertex.x;
  const vy = nextPt.y - vertex.y;
  const vLen = Math.hypot(vx, vy) || 1;

  const p1 = { x: vertex.x + (ux / uLen) * size, y: vertex.y + (uy / uLen) * size };
  const p3 = { x: vertex.x + (vx / vLen) * size, y: vertex.y + (vy / vLen) * size };
  const p2 = { x: p1.x + (vx / vLen) * size, y: p1.y + (vy / vLen) * size };

  return `${p1.x.toFixed(1)},${p1.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} ${p3.x.toFixed(1)},${p3.y.toFixed(1)}`;
}

export function getAngleLabelPosition(angle: GeometryAngleElement): Point2D {
  const midDeg = angle.startAngleDeg + angle.sweepAngleDeg / 2;
  const rad = degToRad(midDeg);
  const labelDist = angle.radius + 16;
  return {
    x: angle.cx + labelDist * Math.cos(rad),
    y: angle.cy + labelDist * Math.sin(rad),
  };
}

export function getLineStrokeDashArray(style?: 'solid' | 'dashed' | 'dotted'): string | undefined {
  if (style === 'dashed') return '7 5';
  if (style === 'dotted') return '2.5 4';
  return undefined;
}

export function getLineLabelPosition(line: GeometryLineElement): Point2D {
  const mx = (line.x1 + line.x2) / 2;
  const my = (line.y1 + line.y2) / 2;
  const dx = line.x2 - line.x1;
  const dy = line.y2 - line.y1;
  const len = Math.hypot(dx, dy) || 1;
  // Offset slightly perpendicular to line
  const nx = -dy / len;
  const ny = dx / len;
  return {
    x: mx + nx * 15,
    y: my + ny * 15,
  };
}

export interface ComputedHistogramBar {
  id: string;
  min: number;
  max: number;
  width: number;
  frequency: number;
  frequencyDensity: number;
  heightMetric: number;
  color: string;
}

export function computeHistogramBars(
  bins: Array<{ id: string; min: number; max: number; frequency: number; color: string }>
): { bars: ComputedHistogramBar[]; hasUnequalWidths: boolean; yLabelDefault: string } {
  if (bins.length === 0) {
    return { bars: [], hasUnequalWidths: false, yLabelDefault: 'Frequency' };
  }
  const widths = bins.map((b) => Math.max(0.0001, b.max - b.min));
  const firstW = widths[0];
  const hasUnequalWidths = widths.some((w) => Math.abs(w - firstW) > 1e-6);

  const bars: ComputedHistogramBar[] = bins.map((b) => {
    const w = Math.max(0.0001, b.max - b.min);
    const density = b.frequency / w;
    return {
      id: b.id,
      min: b.min,
      max: b.max,
      width: w,
      frequency: b.frequency,
      frequencyDensity: density,
      heightMetric: hasUnequalWidths ? density : b.frequency,
      color: b.color,
    };
  });

  return {
    bars,
    hasUnequalWidths,
    yLabelDefault: hasUnequalWidths ? 'Frequency Density' : 'Frequency',
  };
}
