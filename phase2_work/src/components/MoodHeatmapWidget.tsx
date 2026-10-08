import { klarStorage } from '../lib/userScopedStorage';
import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Calendar } from 'lucide-react';

export function MoodHeatmapWidget() {
  const d3Container = useRef<HTMLDivElement>(null);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    const rawLogs = klarStorage.getItem('klar_reflection_logs');
    const logs = rawLogs ? JSON.parse(rawLogs) : [];

    if (logs.length === 0 || !d3Container.current) {
      setHasData(false);
      return;
    }
    setHasData(true);

    d3.select(d3Container.current).selectAll('*').remove();

    const width = d3Container.current.clientWidth;
    const height = 100;
    const margin = { top: 10, right: 10, bottom: 20, left: 10 };

    const svg = d3.select(d3Container.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Array.from({length: 30}, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (29 - i));
      return d;
    });

    const moodScore = { 'good': 3, 'neutral': 2, 'bad': 1 };

    const dataByDate = new Map();
    logs.forEach((l: unknown) => {
      const d = new Date(l.date);
      d.setHours(0,0,0,0);
      dataByDate.set(d.getTime(), moodScore[l.mood as keyof typeof moodScore]);
    });

    const dataset = days.map(d => ({
      date: d,
      score: dataByDate.get(d.getTime()) || 0
    }));

    const innerWidth = width - margin.left - margin.right;
    const cellSize = Math.min(innerWidth / 30, 24);
    const spacing = 2;

    const colorScale = d3.scaleOrdinal<number, string>()
      .domain([0, 1, 2, 3])
      .range(['#f5f5f4', '#f43f5e', '#f59e0b', '#10b981']);

    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      colorScale.range(['#292524', '#f43f5e', '#f59e0b', '#10b981']);
    }

    const g = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    g.selectAll('rect')
      .data(dataset)
      .enter()
      .append('rect')
      .attr('x', (_, i) => i * (cellSize + spacing))
      .attr('y', height / 2 - cellSize / 2 - margin.top)
      .attr('width', cellSize)
      .attr('height', cellSize)
      .attr('rx', 4)
      .attr('fill', d => colorScale(d.score))
      .append('title')
      .text(d => `${d.date.toLocaleDateString('de-DE')}: ${d.score === 3 ? 'Gut' : d.score === 2 ? 'Neutral' : d.score === 1 ? 'Schlecht' : 'Kein Eintrag'}`);

  }, []);

  return (
    <div className="bg-white dark:bg-stone-800 rounded-3xl p-6 shadow-sm border border-stone-100 dark:border-stone-700 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={18} className="text-stone-500" />
        <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Stimmungs-Trend (30 Tage)</h3>
      </div>
      {!hasData ? (
        <p className="text-sm text-stone-500 dark:text-stone-400">Noch keine Reflexionen vorhanden.</p>
      ) : (
        <div ref={d3Container} className="w-full h-[100px] overflow-hidden" />
      )}
    </div>
  );
}
