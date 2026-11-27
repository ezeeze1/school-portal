export type DiagramMode = 'geometry' | 'graph' | 'chart';

export type DiagramPlacement = 'above' | 'below' | 'inline';

export type GeometryUnit = '' | 'mm' | 'cm' | 'm' | 'km';

export type GeometryShapeKind =
  | 'rectangle'
  | 'square'
  | 'triangle'
  | 'right_triangle'
  | 'equilateral_triangle'
  | 'isosceles_triangle'
  | 'circle'
  | 'semicircle'
  | 'ellipse'
  | 'parallelogram'
  | 'trapezium'
  | 'rhombus'
  | 'kite'
  | 'polygon';

export type GeometryLineKind =
  | 'line'
  | 'segment'
  | 'horizontal'
  | 'vertical'
  | 'diagonal'
  | 'parallel_pair'
  | 'perpendicular_pair'
  | 'radius'
  | 'diameter'
  | 'chord'
  | 'tangent'
  | 'arc'
  | 'sector'
  | 'measurement';

export type GeometryAngleKind =
  | 'acute'
  | 'right'
  | 'obtuse'
  | 'straight'
  | 'reflex'
  | 'arc';

export interface GeometryShapeElement {
  id: string;
  kind: 'shape';
  shapeKind: GeometryShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sides?: number; // regular polygon 5..10
  topRatio?: number; // trapezium top width ratio (0.2..0.9)
  skewRatio?: number; // parallelogram horizontal skew ratio (-0.5..0.5)
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
  fillTransparent?: boolean;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  vertexLabels?: string[];
  sideLabels?: Record<string, string>;
  unit?: GeometryUnit;
  rightAngleCorner?: number; // vertex index to draw right-angle marker
  hideMeasurement?: boolean;
}

export interface GeometryLineElement {
  id: string;
  kind: 'line';
  lineKind: GeometryLineKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  radius?: number; // used for arc/sector
  startAngleDeg?: number; // used for arc/sector
  endAngleDeg?: number; // used for arc/sector
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
  fillTransparent?: boolean;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  arrowStart?: boolean;
  arrowEnd?: boolean;
  parallelTicks?: number; // 0..2
  equalTicks?: number; // 0..2
  label?: string;
  unit?: GeometryUnit;
  hideMeasurement?: boolean;
}

export interface GeometryAngleElement {
  id: string;
  kind: 'angle';
  angleKind: GeometryAngleKind;
  cx: number;
  cy: number;
  radius: number;
  startAngleDeg: number;
  sweepAngleDeg: number;
  drawRays?: boolean;
  rayLength?: number;
  rightAngleSquare?: boolean;
  label?: string;
  showDegreeSymbol?: boolean;
  hideMeasurement?: boolean;
  strokeColor: string;
  strokeWidth: number;
  fillColor?: string;
}

export interface GeometryLabelElement {
  id: string;
  kind: 'label';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
}

export type GeometryElement =
  | GeometryShapeElement
  | GeometryLineElement
  | GeometryAngleElement
  | GeometryLabelElement;

export interface GeometryScene {
  elements: GeometryElement[];
}

export interface GraphEquationItem {
  id: string;
  expression: string;
  label?: string;
  color: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export interface GraphPointItem {
  id: string;
  x: number;
  y: number;
  label?: string;
  color: string;
  showCoordinates?: boolean;
}

export interface CoordinateGraphConfig {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xStep: number;
  yStep: number;
  xLabel?: string;
  yLabel?: string;
  xUnit?: string;
  yUnit?: string;
  showGrid: boolean;
  showOriginLabel: boolean;
  equations: GraphEquationItem[];
  points: GraphPointItem[];
  connectPoints: boolean;
  connectColor?: string;
  closePolygon?: boolean;
}

export type StatisticalChartType =
  | 'bar'
  | 'histogram'
  | 'pie'
  | 'line'
  | 'frequency_polygon'
  | 'scatter';

export interface ChartCategoryItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface ChartHistogramBin {
  id: string;
  min: number;
  max: number;
  frequency: number;
  color: string;
}

export interface ChartScatterPoint {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface StatisticalChartConfig {
  chartType: StatisticalChartType;
  xAxisLabel?: string;
  yAxisLabel?: string;
  showGrid?: boolean;
  showLegend?: boolean;
  showValues?: boolean;
  yMin?: number;
  yMax?: number;
  yStep?: number;
  categories?: ChartCategoryItem[];
  bins?: ChartHistogramBin[];
  scatterPoints?: ChartScatterPoint[];
  accentColor?: string;
}

export interface CBTDiagramSpec {
  version: 1;
  id?: string;
  mode: DiagramMode;
  width: number;
  height: number;
  title?: string;
  caption?: string;
  gridEnabled?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  notDrawnToScale?: boolean;
  geometry?: GeometryScene;
  graph?: CoordinateGraphConfig;
  chart?: StatisticalChartConfig;
}

export interface DiagramValidationResult {
  ok: boolean;
  error?: string;
  sanitized?: CBTDiagramSpec;
}
