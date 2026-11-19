// Stroke geometry for handwriting practice. Pure functions, no DOM: used by the browser to grade
// strokes and by scripts/build-kanji.mts to precompute sample points from KanjiVG paths.
// All coordinates are in KanjiVG's 109×109 box.

export type Point = [number, number];

export const SAMPLE_COUNT = 24;
const CURVE_STEPS = 12;

/** Converts a KanjiVG path (M/m, C/c, S/s, L/l only) into a polyline. */
export function pathToPoints(d: string): Point[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const points: Point[] = [];
  let i = 0;
  let command = '';
  let x = 0, y = 0;
  let lastControl: Point | null = null;
  const num = () => {
    const value = Number(tokens[i++]);
    if (!Number.isFinite(value)) throw new Error(`Bad number in path: ${d}`);
    return value;
  };
  const cubic = (c1: Point, c2: Point, end: Point) => {
    const start: Point = [x, y];
    for (let step = 1; step <= CURVE_STEPS; step++) {
      const t = step / CURVE_STEPS, u = 1 - t;
      points.push([
        u * u * u * start[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * end[0],
        u * u * u * start[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * end[1]
      ]);
    }
    lastControl = c2;
    [x, y] = end;
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    const ox = relative ? x : 0, oy = relative ? y : 0;
    switch (command.toLowerCase()) {
      case 'm': {
        x = ox + num(); y = oy + num();
        points.push([x, y]);
        lastControl = null;
        command = relative ? 'l' : 'L'; // Extra pairs after M are implicit line-tos.
        break;
      }
      case 'l': {
        x = ox + num(); y = oy + num();
        points.push([x, y]);
        lastControl = null;
        break;
      }
      case 'c': {
        const c1: Point = [ox + num(), oy + num()];
        const c2: Point = [ox + num(), oy + num()];
        cubic(c1, c2, [ox + num(), oy + num()]);
        break;
      }
      case 's': {
        const reflected: Point = lastControl ? [2 * x - lastControl[0], 2 * y - lastControl[1]] : [x, y];
        const c2: Point = [ox + num(), oy + num()];
        cubic(reflected, c2, [ox + num(), oy + num()]);
        break;
      }
      default:
        throw new Error(`Unsupported path command "${command}" in: ${d}`);
    }
  }
  return points;
}

const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
  return total;
}

/** Resamples a polyline to `count` points evenly spaced along its length. */
export function resample(points: Point[], count = SAMPLE_COUNT): Point[] {
  if (points.length === 0) return [];
  const total = pathLength(points);
  if (points.length === 1 || total === 0) return Array.from({length: count}, () => [...points[0]] as Point);
  const interval = total / (count - 1);
  const out: Point[] = [[...points[0]] as Point];
  let carried = 0;
  for (let i = 1; i < points.length && out.length < count; i++) {
    let prev = points[i - 1];
    const next = points[i];
    let segment = distance(prev, next);
    while (carried + segment >= interval && out.length < count) {
      const t = (interval - carried) / segment;
      const point: Point = [prev[0] + t * (next[0] - prev[0]), prev[1] + t * (next[1] - prev[1])];
      out.push(point);
      segment -= interval - carried;
      prev = point;
      carried = 0;
    }
    carried += segment;
  }
  while (out.length < count) out.push([...points[points.length - 1]] as Point);
  return out;
}

export type StrokeResult = {ok: true} | {ok: false; reason: 'tooShort' | 'direction' | 'shape' | 'position' | 'order'};

/**
 * Grades one handwritten stroke against the expected stroke.
 * Tolerant on purpose: learners write on phones with fingers. It checks position (average
 * distance), direction (where the stroke starts), and rough length.
 */
export function gradeStroke(drawn: Point[], expected: Point[], tolerance = 1): StrokeResult {
  const expectedLength = pathLength(expected);
  const drawnLength = pathLength(drawn);
  // Short strokes (dots like in 六 or 気) get a floor so a quick tap-and-flick still counts.
  const minLength = Math.min(expectedLength * 0.35, 12);
  if (drawn.length < 2 || drawnLength < Math.max(3, minLength)) return {ok: false, reason: 'tooShort'};

  const a = resample(drawn), b = resample(expected);
  const start = distance(a[0], b[0]), end = distance(a[a.length - 1], b[b.length - 1]);
  const swappedStart = distance(a[0], b[b.length - 1]), swappedEnd = distance(a[a.length - 1], b[0]);
  const limit = 16 * tolerance;
  // A clearly reversed stroke (written from the wrong end) is a direction mistake.
  if (expectedLength > 8 && swappedStart + swappedEnd < (start + end) * 0.6 && swappedStart < limit * 1.5) {
    return {ok: false, reason: 'direction'};
  }
  if (start > limit * 1.6 || end > limit * 1.6) return {ok: false, reason: 'position'};
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += distance(a[i], b[i]);
  if (sum / a.length > limit) return {ok: false, reason: 'position'};
  if (drawnLength > Math.max(expectedLength * 2.6, expectedLength + 25)) return {ok: false, reason: 'shape'};
  return {ok: true};
}

function meanDistance(drawn: Point[], expected: Point[]): number {
  const a = resample(drawn), b = resample(expected);
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += distance(a[i], b[i]);
  return sum / a.length;
}

/**
 * Grades the stroke expected at `index`, and also catches stroke-order mistakes: a stroke that
 * fits a later stroke clearly better (common with parallel lines, as in 曜 or 語) is rejected.
 */
export function gradeStrokeAt(drawn: Point[], strokes: Point[][], index: number, tolerance = 1): StrokeResult {
  const result = gradeStroke(drawn, strokes[index], tolerance);
  if (!result.ok) {
    const later = strokes.slice(index + 1);
    return later.some(stroke => gradeStroke(drawn, stroke, tolerance).ok) ? {ok: false, reason: 'order'} : result;
  }
  const own = meanDistance(drawn, strokes[index]);
  for (const stroke of strokes.slice(index + 1)) {
    if (meanDistance(drawn, stroke) < own * 0.7 && gradeStroke(drawn, stroke, tolerance).ok) return {ok: false, reason: 'order'};
  }
  return result;
}
