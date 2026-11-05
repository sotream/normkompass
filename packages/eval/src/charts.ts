/**
 * SVG charts drawn directly as text, without a charting library. Every chart has its own background so it
 * stays legible whatever page theme it is shown on, a title and a description for readers who cannot see it,
 * and uses fixed-precision coordinates so the same data always gives the same file.
 */

export interface BarRow {
  /** Label lines shown left of the bars. */
  label: string[];
  /** One entry per series, in the order of `series`. */
  values: { value: number; lo?: number; hi?: number }[];
  /** Draw this row's label in bold (the configuration the project uses). */
  emphasis?: boolean;
}

export interface BarChart {
  title: string;
  description: string;
  series: string[];
  rows: BarRow[];
  /** Plain lines under the chart (sample size, who wrote the questions, how to read the whiskers). */
  notes: string[];
}

export interface DotRow {
  label: string;
  /** One value per recorded run. */
  values: number[];
}

export interface DotGroup {
  title: string;
  rows: DotRow[];
}

export interface DotChart {
  title: string;
  description: string;
  groups: DotGroup[];
  notes: string[];
}

const WIDTH = 640;
const f = (x: number): string => x.toFixed(1);
const v = (x: number): string => x.toFixed(3);

export const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `<style>
  .bg{fill:#ffffff}
  .t{fill:#1f2328;font:600 17px system-ui,sans-serif}
  .l{fill:#1f2328;font:13px system-ui,sans-serif}
  .lb{fill:#1f2328;font:600 13px system-ui,sans-serif}
  .n{fill:#59636e;font:12px system-ui,sans-serif}
  .axis{stroke:#d1d9e0;stroke-width:1}
  .whisker{stroke:#1f2328;stroke-width:1.5}
  .s0{fill:#2f6fb3}
  .s1{fill:#c2691a}
  .line{stroke:#8c959f;stroke-width:3;stroke-linecap:round}
  @media (prefers-color-scheme: dark){
    .bg{fill:#0d1117}
    .t,.l,.lb{fill:#e6edf3}
    .n{fill:#9198a1}
    .axis{stroke:#3d444d}
    .whisker{stroke:#e6edf3}
    .s0{fill:#6aa8e8}
    .s1{fill:#e7a35c}
    .line{stroke:#6e7681}
  }
</style>`;

function frame(
  title: string,
  description: string,
  height: number,
  body: string,
  notes: string[],
  notesTop: number,
): string {
  const noteText = notes
    .map((n, i) => `<text class="n" x="20" y="${f(notesTop + i * 17)}">${escapeXml(n)}</text>`)
    .join('\n  ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${f(height)}" width="${WIDTH}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(description)}</desc>
  ${STYLE}
  <rect class="bg" width="${WIDTH}" height="${f(height)}" rx="8"/>
  <text class="t" x="20" y="30">${escapeXml(title)}</text>
  ${body}
  ${noteText}
</svg>
`;
}

/** Horizontal grouped bars on a 0 to 1 scale, with optional whiskers for an interval. */
export function renderBarChart(chart: BarChart): string {
  const plotX = 250;
  const plotW = 300;
  const top = 78;
  const barH = 13;
  const gap = 3;
  const rowPad = 14;
  const lines = chart.rows.map((r) => Math.max(r.label.length, 1));
  const parts: string[] = [];

  // legend
  chart.series.forEach((name, i) => {
    const x = 20 + i * 150;
    parts.push(
      `<rect class="s${i}" x="${f(x)}" y="46" width="12" height="12" rx="2"/>`,
      `<text class="l" x="${f(x + 18)}" y="57">${escapeXml(name)}</text>`,
    );
  });

  let y = top;
  const x0 = plotX;
  const bandStart = y;
  chart.rows.forEach((row, ri) => {
    const rowH = Math.max(chart.series.length * (barH + gap), (lines[ri] ?? 1) * 16) + rowPad;
    row.label.forEach((line, li) => {
      parts.push(
        `<text class="${row.emphasis ? 'lb' : 'l'}" x="20" y="${f(y + 12 + li * 16)}">${escapeXml(line)}</text>`,
      );
    });
    row.values.forEach((val, si) => {
      const by = y + si * (barH + gap);
      const w = Math.max(0, Math.min(1, val.value)) * plotW;
      parts.push(
        `<rect class="s${si}" x="${f(x0)}" y="${f(by)}" width="${f(w)}" height="${barH}" rx="2"/>`,
      );
      if (val.lo !== undefined && val.hi !== undefined) {
        const lx = x0 + Math.max(0, val.lo) * plotW;
        const hx = x0 + Math.min(1, val.hi) * plotW;
        const cy = by + barH / 2;
        parts.push(
          `<line class="whisker" x1="${f(lx)}" y1="${f(cy)}" x2="${f(hx)}" y2="${f(cy)}"/>`,
          `<line class="whisker" x1="${f(lx)}" y1="${f(cy - 4)}" x2="${f(lx)}" y2="${f(cy + 4)}"/>`,
          `<line class="whisker" x1="${f(hx)}" y1="${f(cy - 4)}" x2="${f(hx)}" y2="${f(cy + 4)}"/>`,
        );
      }
      const labelX = x0 + Math.min(1, val.hi ?? val.value) * plotW + 12;
      parts.push(`<text class="l" x="${f(labelX)}" y="${f(by + 11)}">${v(val.value)}</text>`);
    });
    y += rowH;
  });
  // axis with ticks at 0, 0.5, 1
  parts.push(
    `<line class="axis" x1="${f(x0)}" y1="${f(bandStart - 6)}" x2="${f(x0)}" y2="${f(y)}"/>`,
  );
  for (const t of [0.5, 1]) {
    const tx = x0 + t * plotW;
    parts.push(
      `<line class="axis" x1="${f(tx)}" y1="${f(bandStart - 6)}" x2="${f(tx)}" y2="${f(y)}"/>`,
    );
  }
  for (const t of [0, 0.5, 1]) {
    parts.push(
      `<text class="n" x="${f(x0 + t * plotW)}" y="${f(y + 14)}" text-anchor="middle">${t === 0 ? '0' : t.toFixed(1)}</text>`,
    );
  }
  const notesTop = y + 38;
  const height = notesTop + chart.notes.length * 17 + 10;
  return frame(chart.title, chart.description, height, parts.join('\n  '), chart.notes, notesTop);
}

/** One dot per recorded run on a 0 to 1 scale, with a line from the lowest to the highest run. */
export function renderDotChart(chart: DotChart): string {
  const plotX = 250;
  const plotW = 250;
  const rowH = 24;
  const parts: string[] = [];
  let y = 56;
  const axisTop = y - 4;
  for (const group of chart.groups) {
    parts.push(`<text class="lb" x="20" y="${f(y + 14)}">${escapeXml(group.title)}</text>`);
    y += 22;
    for (const row of group.rows) {
      const cy = y + 10;
      parts.push(`<text class="l" x="36" y="${f(cy + 4)}">${escapeXml(row.label)}</text>`);
      const lo = Math.min(...row.values);
      const hi = Math.max(...row.values);
      if (row.values.length > 1) {
        parts.push(
          `<line class="line" x1="${f(plotX + lo * plotW)}" y1="${f(cy)}" x2="${f(plotX + hi * plotW)}" y2="${f(cy)}"/>`,
        );
      }
      for (const val of row.values) {
        parts.push(`<circle class="s0" cx="${f(plotX + val * plotW)}" cy="${f(cy)}" r="4.5"/>`);
      }
      const text = row.values.length > 1 ? `${v(lo)} to ${v(hi)}` : v(hi);
      parts.push(
        `<text class="l" x="${f(plotX + hi * plotW + 12)}" y="${f(cy + 4)}">${text}</text>`,
      );
      y += rowH;
    }
    y += 8;
  }
  for (const t of [0, 0.5, 1]) {
    const tx = plotX + t * plotW;
    parts.push(
      `<line class="axis" x1="${f(tx)}" y1="${f(axisTop)}" x2="${f(tx)}" y2="${f(y - 6)}"/>`,
      `<text class="n" x="${f(tx)}" y="${f(y + 8)}" text-anchor="middle">${t === 0 ? '0' : t.toFixed(1)}</text>`,
    );
  }
  const notesTop = y + 34;
  const height = notesTop + chart.notes.length * 17 + 10;
  return frame(chart.title, chart.description, height, parts.join('\n  '), chart.notes, notesTop);
}
