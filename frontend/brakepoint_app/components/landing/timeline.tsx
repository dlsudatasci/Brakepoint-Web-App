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
import {
  CameraSummary, VideoSummary,
  VehicleBreakdown, sumBreakdowns
} from "@/components/landing/summaryTypes"
import AnalyticsCard from "./analyticsCard";

import "@/components/landing/timeline.css"

// ===========================================
// Types
// ===========================================

type TimelineRow = {
  date: Date;
  speeding: number | null;
  swerving: number | null;
  abruptStop: number | null;
};

type TimelineProps = {
  /** Camera IDs whose data should be aggregated. When empty the chart shows a prompt. */
  // cameraIds?: (number | string)[]; 
  videos: VideoSummary[],
};

// ===========================================
// Constants
// ===========================================
const METRIC_CFG = [
  { key: 'speeding', label: 'Speeding', color: 'blue' },
  { key: 'swerving', label: 'Swerving', color: 'red' },
  { key: 'abruptStop', label: 'Abrupt stopping', color: 'yellow' },
  { key: 'vehicles', label: 'Total vehicles', color: 'green' },
] as const;

type MetricKey = typeof METRIC_CFG[number]['key'];

// ===========================================
// Stats helper
// ===========================================
// represents various aggregations and measures for adb counts
type AdbStatisticsAggregation = { total: number, mean: number, std: number, median: number, min: number, max: number }

// computes various aggregations and measures for a given set of values
function computeStats(values: (number | null)[]) {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return { total: 0, mean: 0, std: 0, min: 0, max: 0, median: 0 }

  const total = valid.reduce((s, v) => s + v, 0)
  const mean = total / valid.length;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - mean) ** 2, 0) / valid.length);
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];

  return { total, mean, std, min: Math.min(...valid), max: Math.max(...valid), median };
}

// ===========================================
// Component
// ===========================================
export default function Timeline({ videos = [] }: TimelineProps) {

  // --- filter / UI state ---
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([ 'speeding', 'swerving', 'abruptStop', 'vehicles' ]);
  const [filteredVideos, setFilteredVideos] = useState<VideoSummary[]>([])

  // --- statistics!
  const [totalBreakdown, setTotalBreakdown] = useState<VehicleBreakdown>();
  const [adbStatistics, setAdbStatistics] = useState<{
    "vehicles": AdbStatisticsAggregation,
    "speeding": AdbStatisticsAggregation,
    "swerving": AdbStatisticsAggregation,
    "abruptStop": AdbStatisticsAggregation
  }>()

  // Stabilise the array prop so useCallback/useEffect don't loop
  // const cameraIdsKey = JSON.stringify([...cameraIds].sort());

  // --- update the list of currently filtered videos ---
  useEffect(() => {
    const newVideos: VideoSummary[] = videos.filter((vid) => {
      const dateOfThis = dayjs(vid.start_time ?? vid.uploaded_at);
      if (startDate && startDate.isAfter(dateOfThis)) return false;
      if (endDate && endDate.isBefore(dateOfThis)) return false;
      return true;
    }); 
    
    // return an array sorted by date
    newVideos.sort((a, b) => a.recorded_at.getTime() - b.recorded_at.getTime());
    setFilteredVideos(newVideos)
    
    // update breakdown statistics accordingly
    const totalBreakdown: VehicleBreakdown = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0};
    for (const curr of newVideos) { sumBreakdowns(totalBreakdown, curr.vehicle_breakdown) }
    setTotalBreakdown(totalBreakdown)

    setAdbStatistics({
      speeding: computeStats(newVideos.map(d => d.speeding_count)),
      swerving: computeStats(newVideos.map(d => d.swerving_count)),
      abruptStop: computeStats(newVideos.map(d => d.abrupt_stopping_count)),
      vehicles: computeStats(newVideos.map(d => d.vehicles)),
    })

  }, [startDate, endDate])

  // --- helpers ---
  const isOn = (k: string) => selectedMetrics.includes(k);

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

      <LandingSection type="header" labelHeader="Vehicle counts" canHide>
        <AnalyticsCard
          variant="bar"
          data={totalBreakdown ?? []}
          compact
        />
      </LandingSection>

      {/* ====== Timeline ===== */}
            
      <LandingSection type="header" labelHeader="ADB counts" canHide>
        {/* ADB stat cards */}
        {filteredVideos.length > 0 && selectedMetrics.length > 0 && (
          <div className="adb-stats-container">
            {METRIC_CFG.map(({ key, label, color }) => {
              const s = adbStatistics[key as MetricKey];
              if (!s || s.mean == null) return null;
              const isVisible = key === 'vehicles' || isOn(key);
              if (!isVisible) return null;

              return (
                <div className={`adb-stats adb-${color}`} key={key}>
                  <div className="adb-stats-header"> {label} </div>
                  <div className="adb-stats-row">
                    <div> Mean </div> <div> { (Math.floor(s.mean)).toFixed(0) } </div>
                  </div>
                  <div className="adb-stats-row">
                    <div> Std </div> <div> { `\u00B1${(Math.ceil(s.std!)).toFixed(0)}` } </div>
                  </div>
                  <div className="adb-stats-row">
                    <div> Range </div> <div> { `${s.min} - ${s.max}` } </div>
                  </div>
                </div>
                );
            })}
          </div>
        )}

        {/* ===== Chart Area ===== */}
        <Box sx={{ mt: 2 }}>

          {/* ---------- Charts ---------- */}
          { filteredVideos.length > 0 && (
            <div className="adb-chart-container">
              <BarChart
                layout="horizontal"
                width={500}
                height={Math.max(150, filteredVideos.length * 52)}
                yAxis={[{
                  data: filteredVideos.map(d =>
                    d.recorded_at.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' })
                  ),
                  scaleType: 'band',
                }]}
                xAxis={[{ label: 'Cases' }]}
                series={[
                  ...(isOn('speeding') ? [{
                    id: 'adb-sp', stack: 'adb', label: 'Speeding', color: '#5c6bc0',
                    data: filteredVideos.map(d => d.speeding_count ?? 0),
                    valueFormatter: (v: number) => `${v} vehicles`,
                  }] : []),
                  ...(isOn('swerving') ? [{
                    id: 'adb-sw', stack: 'adb', label: 'Swerving', color: '#ef5350',
                    data: filteredVideos.map(d => d.swerving_count ?? 0),
                    valueFormatter: (v: number) => `${v} vehicles`,
                  }] : []),
                  ...(isOn('abruptStop') ? [{
                    id: 'adb-as', stack: 'adb', label: 'Abrupt stopping', color: '#ffa726',
                    data: filteredVideos.map(d => d.abrupt_stopping_count ?? 0),
                    valueFormatter: (v: number) => `${v} vehicles`,
                  }] : []),
                ]}
                sx={{
                  'svg': { width: "100%;" },
                  '& .MuiChartsAxis-tickLabel': {
                    fontFamily: 'inherit',
                    fontSize: '0.75rem',
                  },
                }}
              />
            </div>
          )}
        </Box>
      </LandingSection>
    </>
  );
}
