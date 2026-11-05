import { describe, expect, it } from 'vitest';
import { renderBarChart, renderDotChart, escapeXml, type BarChart } from './charts.js';
import { bootstrapMeanInterval } from './compare.js';

const chart: BarChart = {
  title: 'Title <a> & "b"',
  description: 'A chart',
  series: ['recall@5', 'MRR'],
  rows: [
    {
      label: ['row one'],
      emphasis: true,
      values: [
        { value: 0.9, lo: 0.8, hi: 0.95 },
        { value: 0.5, lo: 0.4, hi: 0.6 },
      ],
    },
    { label: ['row two', 'second line'], values: [{ value: 0.1 }, { value: 0 }] },
  ],
  notes: ['note'],
};

describe('renderBarChart', () => {
  it('is deterministic and has a title and description', () => {
    const a = renderBarChart(chart);
    expect(renderBarChart(chart)).toBe(a);
    expect(a).toContain('<title id="title">Title &lt;a&gt; &amp; &quot;b&quot;</title>');
    expect(a).toContain('<desc id="desc">A chart</desc>');
  });

  it('draws values with three decimals and intervals as whiskers', () => {
    const svg = renderBarChart(chart);
    expect(svg).toContain('>0.900<');
    expect(svg).toContain('>0.100<');
    expect(svg.match(/class="whisker"/g)).toHaveLength(6); // two intervals, three lines each
  });

  it('keeps a dark-theme style and its own background', () => {
    const svg = renderBarChart(chart);
    expect(svg).toContain('prefers-color-scheme: dark');
    expect(svg).toContain('class="bg"');
  });

  it('keeps every drawn element inside the 640 px width', () => {
    const svg = renderBarChart({
      ...chart,
      rows: [{ label: ['x'], values: [{ value: 1, lo: 1, hi: 1 }, { value: 1 }] }],
    });
    for (const m of svg.matchAll(/<text[^>]* x="([\d.]+)"[^>]*>([^<]*)</g)) {
      const x = Number(m[1]);
      const width = (m[2] ?? '').length * 7;
      expect(x + width).toBeLessThanOrEqual(640);
    }
  });
});

describe('renderDotChart', () => {
  it('shows a range for several runs and a single value for one', () => {
    const svg = renderDotChart({
      title: 't',
      description: 'd',
      groups: [
        { title: 'multi', rows: [{ label: 'm', values: [0.94, 0.976] }] },
        { title: 'one', rows: [{ label: 'o', values: [0.486] }] },
      ],
      notes: [],
    });
    expect(svg).toContain('0.940 to 0.976');
    expect(svg).toContain('>0.486<');
    expect(svg.match(/<circle/g)).toHaveLength(3);
  });
});

describe('escapeXml', () => {
  it('escapes markup characters', () => {
    expect(escapeXml('<&>"')).toBe('&lt;&amp;&gt;&quot;');
  });
});

describe('bootstrapMeanInterval', () => {
  it('is deterministic and contains the mean', () => {
    const values = [1, 0, 1, 1, 0, 1, 1, 1, 0, 1];
    const a = bootstrapMeanInterval(values);
    expect(bootstrapMeanInterval(values)).toEqual(a);
    expect(a.mean).toBeCloseTo(0.7);
    expect(a.lo).toBeLessThanOrEqual(a.mean);
    expect(a.hi).toBeGreaterThanOrEqual(a.mean);
  });

  it('collapses to a point for identical scores and rejects empty input', () => {
    expect(bootstrapMeanInterval([1, 1, 1])).toEqual({ mean: 1, lo: 1, hi: 1 });
    expect(() => bootstrapMeanInterval([])).toThrow();
  });
});
