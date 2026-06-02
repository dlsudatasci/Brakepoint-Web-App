'use client';

import { LineChart } from "@mui/x-charts/LineChart";
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Box, Typography, FormControlLabel, Checkbox, Chip, CircularProgress } from '@mui/material';
import { HighlightScope } from '@mui/x-charts/context';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';
import { authFetch } from '@/lib/authFetch';
import LandingSection from "@/components/landing/landingSection"

import { BarChart } from "@mui/x-charts/BarChart";

// ===========================================
// Types
// ===========================================

type VehicleBreakdown = {
  car: number;
  jeepney: number;
  motorcycle: number;
  bus: number;
  truck: number;
};

type TimelineRow = {
  date: Date;
  speeding: number | null;
  swerving: number | null;
  abruptStop: number | null;
};

type TimelineProps = {
  /** Camera IDs whose data should be aggregated. When empty the chart shows a prompt. */
  cameraIds?: (number | string)[];
};

// ===========================================
// Constants
// ===========================================
const METRIC_CFG = [
  { key: 'speeding', label: 'Speeding', color: '#5c6bc0' },
  { key: 'swerving', label: 'Swerving', color: '#ef5350' },
  { key: 'abruptStop', label: 'Abrupt Stop', color: '#ffa726' },
  { key: 'vehicles', label: 'Vehicles', color: '#66bb6a' },
] as const;

type MetricKey = typeof METRIC_CFG[number]['key'];

// ===========================================
// Dummy Data
// ===========================================
const DUMMY_ROWS: TimelineRow[] = [
  { date: new Date('2026-05-01'), speeding: 4, swerving: 18, abruptStop: 8 },
  { date: new Date('2026-05-02'), speeding: 9, swerving: 15, abruptStop: 12 },
  { date: new Date('2026-05-03'), speeding: 6, swerving: 22, abruptStop: 15 },
  { date: new Date('2026-05-04'), speeding: 3, swerving: 7, abruptStop: 5 },
  { date: new Date('2026-05-05'), speeding: 2, swerving: 12, abruptStop: 6 },
  { date: new Date('2026-05-06'), speeding: 1, swerving: 14, abruptStop: 4 },
  { date: new Date('2026-05-07'), speeding: 5, swerving: 8, abruptStop: 2 },
];

// ===========================================
// Stats helper
// ===========================================
function computeStats(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0)
    return { mean: null, std: null, min: null, max: null, median: null };

  const mean = valid.reduce((s, v) => s + v, 0) / valid.length;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return { mean, std, min: Math.min(...valid), max: Math.max(...valid), median };
}

// ===========================================
// Component
// ===========================================
export default function Timeline({ cameraIds = [] }: TimelineProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(600); // fallback default

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      setChartWidth(entry.contentRect.width);
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);


  // --- data state ---
  const [rows, setRows] = useState<TimelineRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- filter / UI state ---
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'speeding', 'swerving', 'abruptStop', 'vehicles',
  ]);

  // Stabilise the array prop so useCallback/useEffect don't loop
  const cameraIdsKey = JSON.stringify([...cameraIds].sort());

  // --- fetch from backend ---
  const fetchTimeline = useCallback(async () => {
    const ids: (number | string)[] = JSON.parse(cameraIdsKey);
    if (ids.length === 0) { setRows([]); return; }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('camera_ids', ids.join(','));
      if (startDate) params.set('start', startDate.format('YYYY-MM-DD'));
      if (endDate) params.set('end', endDate.format('YYYY-MM-DD'));

      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/behavior-timeline/?${params}`,
      );

      if (!res.ok) throw new Error('Failed to load timeline');
      const json = await res.json();

      if (json.success && Array.isArray(json.timeline)) {
        setRows(
          json.timeline.map((r: any) => ({
            date: new Date(r.date),
            speeding: r.speeding ?? null,
            swerving: r.swerving ?? null,
            abruptStop: r.abrupt_stopping ?? null,
            vehicles: r.vehicles ?? null,
            breakdown: {
              car: (r.breakdown?.car ?? 0) + (r.breakdown?.Car ?? 0),
              jeepney: (r.breakdown?.jeepney ?? 0) + (r.breakdown?.Jeepney ?? 0),
              motorcycle: (r.breakdown?.motorcycle ?? 0) + (r.breakdown?.Motorcycle ?? 0),
              bus: (r.breakdown?.bus ?? 0) + (r.breakdown?.Bus ?? 0),
              truck: (r.breakdown?.truck ?? 0) + (r.breakdown?.Truck ?? 0),
            },
          })),
        );
      } else {
        setRows([]);
      }
    } catch (err: any) {
      setError(err.message ?? 'Unknown error');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [cameraIdsKey, startDate, endDate]);

  useEffect(() => { fetchTimeline(); }, [fetchTimeline]);
  // --- derived data ---
  const sortedData = useMemo(
    () => [...DUMMY_ROWS].sort((a, b) => a.date.getTime() - b.date.getTime()),
    [],
  );

  const totalBreakdown = useMemo(() => {
    const sum = {
      car: 0,
      jeepney: 0,
      motorcycle: 0,
      bus: 0,
      truck: 0,
    };

    // sortedData.forEach(r => {
    //   if (!r.breakdown) return;
    //   sum.car += r.breakdown.car ?? 0;
    //   sum.jeepney += r.breakdown.jeepney ?? 0;
    //   sum.motorcycle += r.breakdown.motorcycle ?? 0;
    //   sum.bus += r.breakdown.bus ?? 0;
    //   sum.truck += r.breakdown.truck ?? 0;
    // });

    return sum;
  }, [sortedData]);

  const statistics = useMemo(() => ({
    speeding: computeStats(sortedData.map(d => d.speeding)),
    swerving: computeStats(sortedData.map(d => d.swerving)),
    abruptStop: computeStats(sortedData.map(d => d.abruptStop)),
    // vehicles: computeStats(sortedData.map(d => d.vehicles)),
  }), [sortedData]);

  const vehicleStats = useMemo(() => [
    { label: 'Car', value: totalBreakdown.car, color: '#FFB422' },
    { label: 'Jeepney', value: totalBreakdown.jeepney, color: '#0DBEFF' },
    { label: 'Motorcycle', value: totalBreakdown.motorcycle, color: '#22BF75' },
    { label: 'Bus', value: totalBreakdown.bus, color: '#4254FB' },
    { label: 'Truck', value: totalBreakdown.truck, color: '#FA4F58' },
  ], [totalBreakdown]);

  const bandData = useMemo(() => {
    const build = (key: MetricKey) => {
      const stats = statistics[key];
      const lower = sortedData.map(d => {
        const v = d[key]; return v == null || stats.std == null ? null : Math.max(0, v - stats.std);
      });
      const upper = sortedData.map(d => {
        const v = d[key]; return v == null || stats.std == null ? null : v + stats.std;
      });
      const band = upper.map((u, i) => u == null || lower[i] == null ? null : u - lower[i]!);
      return { lower, band };
    };
    return { speeding: build('speeding'), swerving: build('swerving'), abruptStop: build('abruptStop'), vehicles: build('vehicles') };
  }, [sortedData, statistics]);

  // --- helpers ---
  const isOn = (k: string) => selectedMetrics.includes(k);
  const bandOp = (k: string) => isOn(k) ? 0.18 : 0;

  const highlightScope: HighlightScope = { highlight: 'series', fade: 'global' };

  const handleToggle = (_: React.MouseEvent<HTMLElement>, next: string[]) => {
    if (next.length > 0) setSelectedMetrics(next);
  };

  // --- empty / loading states ---
  const noData = !loading && sortedData.length === 0;
  const noCameras = cameraIds.length === 0;

  // ===========================================
  // JSX
  // ===========================================
  return (
    <>
    
      <LandingSection type="header" labelHeader="Filter options" canHide startHidden>

        { /* Date pickers */ }
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: "flex", flexDirection: "row", gap: "0.75em" }}>
            <DatePicker
              label="From"
              value={startDate}
              onChange={(v) => { if (!v) return; if (endDate && v.isAfter(endDate)) return; setStartDate(v); }}
              slotProps={{ textField: { size: 'small', sx: { bgcolor: '#fff', borderRadius: '16px', minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } } } }}
            />
            <DatePicker
              label="To"
              value={endDate}
              onChange={(v) => { if (!v) return; if (startDate && v.isBefore(startDate)) return; setEndDate(v); }}
              slotProps={{ textField: { size: 'small', sx: { bgcolor: '#fff', borderRadius: '16px', minWidth: 140, '& .MuiOutlinedInput-root': { borderRadius: '12px' } } } }}
            />
          </Box>
        </LocalizationProvider>

        { /* Metric toggles */ }
        <Box sx={{display: 'flex', mb: 2.5, flexDirection: 'column' }}>
          {METRIC_CFG.filter(c => c.key !== 'vehicles').map(({ key, label, color }) => (
            <FormControlLabel
              key={key}
              label={label}
              control={
                <Checkbox
                  checked={isOn(key)}
                  onChange={(e) =>
                    setSelectedMetrics(prev =>
                      e.target.checked ? [...prev, key] : prev.filter(k => k !== key)
                    )
                  }
                  sx={{
                    color,
                    '&.Mui-checked': { color: '#161b4c' },
                  }}
                />
              }
            />
          ))}
        </Box>

      </LandingSection>
      

      {/* Metric toggles */}

      {/* ====== Timeline ===== */}
      
      <LandingSection type="header" labelHeader="Timeline" canHide>
        <Box ref={chartContainerRef}
          sx={{
            width: '100%',
            bgcolor: '#fff',
            borderRadius: '16px',
            p: { xs: 2, sm: 3 },
            boxSizing: 'border-box',
          }}
        >

          {/* Stat cards */}
          {/* {sortedData.length > 0 && selectedMetrics.length > 0 && (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
              gap: 1.5,
              mb: 2.5,
            }}
          >
            {METRIC_CFG.map(({ key, label, color }) => {
              const s = statistics[key as MetricKey];
              if (!s || s.mean == null) return null;
              const isVisible = key === 'vehicles' || isOn(key);
              if (!isVisible) return null;

              return (
                <Box
                  key={key}
                  sx={{
                    p: 1.5,
                    borderRadius: '12px',
                    border: `1.5px solid ${color}40`,
                    bgcolor: `${color}08`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                    <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="caption" sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#1d1f3f' }}>
                      {label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                    {([
                      ['Mean (Vehicles)', (Math.floor(s.mean)).toFixed(0)],
                      ['Std (Vehicles)', `\u00B1${(Math.ceil(s.std!)).toFixed(0)}`],
                      ['Range', `${s.min} - ${s.max}`],
                    ] as [string, string | number][]).map(([lbl, val]) => (
                      <Box key={lbl}>
                        <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>{lbl}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{val}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )} */}

        {/* ===== Chart Area ===== */}
          <Box sx={{ mt: 2 }}>

            {/* ---------- States ---------- */}
            {loading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 1.5 }}>
                <CircularProgress size={32} sx={{ color: '#1d1f3f' }} />
                <Typography variant="body2" color="text.secondary">
                  Loading timeline data…
                </Typography>
              </Box>
            )}

            {/* {noCameras && !loading && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body2" color="text.secondary">
                Select cameras on the map to view behavior data.
              </Typography>
            </Box>
          )}

          {noData && !noCameras && !error && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body2" color="text.secondary">
                No video data found for the selected cameras and date range.
              </Typography>
            </Box>
          )} */}

            {error && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </Box>
            )}

            {/* ---------- Charts ---------- */}
            {!loading && sortedData.length > 0 && (

              <Box
                sx={{
                  width: '100%'
                }}
              >
                <BarChart
                  width={chartWidth}
                  layout="horizontal"
                  height={Math.max(300, sortedData.length * 52)}
                  yAxis={[{
                    data: sortedData.map(d =>
                      d.date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
                    ),
                    scaleType: 'band',
                  }]}
                  xAxis={[{ label: 'Cases' }]}
                  series={[
                    ...(isOn('speeding') ? [{
                      id: 'sp',
                      data: sortedData.map(d => d.speeding ?? 0),
                      label: 'Speeding',
                      color: '#ef5350',
                      stack: 'adb',
                      valueFormatter: (v: number) => `${v} vehicles`,
                    }] : []),
                    ...(isOn('swerving') ? [{
                      id: 'sw',
                      data: sortedData.map(d => d.swerving ?? 0),
                      label: 'Swerving',
                      color: '#66bb6a',
                      stack: 'adb',
                      valueFormatter: (v: number) => `${v} vehicles`,
                    }] : []),
                    ...(isOn('abruptStop') ? [{
                      id: 'as',
                      data: sortedData.map(d => d.abruptStop ?? 0),
                      label: 'Abrupt Stop',
                      color: '#7e57c2',
                      stack: 'adb',
                      valueFormatter: (v: number) => `${v} vehicles`,
                    }] : []),
                  ]}
                  margin={{ left: 72, right: 24, top: 8, bottom: 40 }}
                  sx={{
                    '& .MuiChartsAxis-tickLabel': {
                      fontFamily: 'inherit',
                      fontSize: '0.75rem',
                    },
                  }}
                />
              </Box>
            )}
          </Box>
        </Box>
      </LandingSection>
    </>
  );
}
