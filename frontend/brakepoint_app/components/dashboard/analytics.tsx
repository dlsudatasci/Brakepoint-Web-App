"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";

import { Box, Grid, Typography, Stack, CircularProgress, Chip } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { Dayjs } from "dayjs";

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";
import SwapCallsIcon from "@mui/icons-material/SwapCalls";
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";

import AnalyticsCard from "./analyticsCard";
import CardCarousel from "./cardCarousel";

import dynamic from "next/dynamic";
const Map = dynamic(() => import("../map/map"), { ssr: false });

import "./analytics.css";
import { authFetch } from "@/lib/authFetch";

export type SubAreaSummary = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  geometry: [number, number][] | null;
  bounds: [[number, number], [number, number]] | null;
  camera_count: number;
  vehicles: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
  adb: number;
  tags: string[];
  thumbnail?: string | null;
  location?: string;
};

type Totals = {
  vehicles: number;
  adb: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
};

type BreakdownEntry = { label: string; value: number };

function fmtRate(count: number, total: number): string {
  if (total === 0) return "0";
  return ((count / total) * 1000).toFixed(1);
}

function getPercentage(count: number, total: number): string {
  if (total === 0) return "0.0%"
  const res = count / total * 100;
  return `${res.toFixed(1)}%`;
}

export default function Analytics() {
  const router = useRouter();

  const [totals, setTotals] = useState<Totals>({
    vehicles: 0,
    adb: 0,
    speeding: 0,
    swerving: 0,
    abrupt_stopping: 0,
  });

  const [breakdown, setBreakdown] = useState<BreakdownEntry[]>([]);
  const [subAreas, setSubAreas] = useState<SubAreaSummary[]>([]);
  const [selectedSubArea, setSelectedSubArea] = useState<SubAreaSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const fetchSummary = useCallback(async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (startDate) {
        params.set("start", startDate.format("YYYY-MM-DD"));
      }

      if (endDate) {
        params.set("end", endDate.format("YYYY-MM-DD"));
      }

      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard-summary/?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");

      const json = await res.json();

      if (json.success) {
        const nextTotals: Totals = json.totals ?? {
          vehicles: 0,
          adb: 0,
          speeding: 0,
          swerving: 0,
          abrupt_stopping: 0,
        };

        const nextSubAreas: SubAreaSummary[] = json.sub_areas ?? [];

        setTotals(nextTotals);
        setSubAreas(nextSubAreas);
        setSelectedSubArea((prev) => {
          if (!nextSubAreas.length) return null;
          if (!prev) return nextSubAreas[0];

          const matched = nextSubAreas.find((s) => s.id === prev.id);
          return matched ?? nextSubAreas[0];
        });

        const bd: BreakdownEntry[] = Object.entries(json.vehicle_breakdown ?? {}).map(([label, value]) => ({
          label,
          value: value as number,
        }));

        setBreakdown(bd);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard summary:", error);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    router.prefetch("/configuration");
    router.prefetch("/monitoring");
  }, [router]);

  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    subAreas.forEach((s) => (s.tags ?? []).forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [subAreas]);

  const filteredSubAreas = useMemo(() => {
    if (selectedTags.length === 0) return subAreas;
    return subAreas.filter((s) => selectedTags.every((tag) => (s.tags ?? []).includes(tag)));
  }, [subAreas, selectedTags]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }, []);

  const dashboardMarkers = useMemo(
    () =>
      filteredSubAreas.map((s) => ({
        id: s.id,
        lat: s.lat,
        lng: s.lng,
        label: s.name,
        popupTitle: s.name,
        popupBody: `${s.camera_count} camera${s.camera_count !== 1 ? "s" : ""} • ${s.vehicles.toLocaleString()} vehicles`,
      })),
    [filteredSubAreas],
  );

  const handleMarkerClick = useCallback(
    (id: number | string) => {
      const matched = filteredSubAreas.find((s) => String(s.id) === String(id));
      if (matched) {
        setSelectedSubArea(matched);
      }

      router.push(`/configuration?savedLocationId=${id}`);
    },
    [filteredSubAreas, router],
  );

  const v = totals.vehicles;

  return (
    <Box className="analytics-container">
      <Box className="analytics-header">
        <Typography variant="h3">Analytics</Typography>

        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <DatePicker
              label="From"
              value={startDate}
              onChange={(v) => {
                if (!v) {
                  setStartDate(null);
                  return;
                }
                if (endDate && v.isAfter(endDate)) return;
                setStartDate(v);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    bgcolor: "#fff",
                    minWidth: 140,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  },
                },
              }}
            />

            <DatePicker
              label="To"
              value={endDate}
              onChange={(v) => {
                if (!v) {
                  setEndDate(null);
                  return;
                }
                if (startDate && v.isBefore(startDate)) return;
                setEndDate(v);
              }}
              slotProps={{
                textField: {
                  size: "small",
                  sx: {
                    bgcolor: "#fff",
                    minWidth: 140,
                    "& .MuiOutlinedInput-root": {
                      borderRadius: "12px",
                    },
                  },
                },
              }}
            />
          </Box>
        </LocalizationProvider>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400, gap: 2 }}>
          <CircularProgress size={32} sx={{ color: "#1d1f3f" }} />
          <Typography color="text.secondary">Loading dashboard…</Typography>
        </Box>
      ) : (
        <>
          <Box className="analytics-card-container">
            <Grid container spacing={{ xs: 2, md: 2 }} alignItems="stretch" sx={{ height: "100%" }}>
              <Grid size={{ xs: 12, md: 3 }} display="flex" sx={{ minWidth: 0 }}>
                <Stack spacing={2} width="100%" height="100%">
                  <AnalyticsCard
                    headerText="Total vehicle count"
                    icon={<DirectionsCarFilledOutlinedIcon />}
                    variant="pie"
                    valueText={v.toLocaleString()}
                    data={breakdown}
                  />
                  <AnalyticsCard
                    headerText="Total ADB count"
                    icon={<ReportProblemOutlinedIcon />}
                    variant="text"
                    valueText={totals.adb.toLocaleString()}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }} display="flex" sx={{ minWidth: 0 }}>
                <Stack spacing={2} width="100%" height="100%">
                  <AnalyticsCard
                    compact
                    headerText="Speeding"
                    icon={<SpeedOutlinedIcon />}
                    variant="text"
                    valueText={`${totals.speeding} (${getPercentage(totals.speeding, v)})`}
                    // valueText={fmtRate(totals.speeding, v)}
                  />
                  <AnalyticsCard
                    compact
                    headerText="Swerving"
                    icon={<SwapCallsIcon />}
                    variant="text"
                    valueText={`${totals.swerving} (${getPercentage(totals.swerving, v)})`}
                    // valueText={fmtRate(totals.swerving, v)}
                  />
                  <AnalyticsCard
                    compact
                    headerText="Abrupt stopping"
                    icon={<PanToolOutlinedIcon />}
                    variant="text"
                    valueText={`${totals.abrupt_stopping} (${getPercentage(totals.abrupt_stopping, v)})`}
                    // valueText={fmtRate(totals.abrupt_stopping, v)}
                  />
                </Stack>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }} display="flex" sx={{ minWidth: 0 }}>
                <Box sx={{ minHeight: { xs: 720, md: "100%" }, width: "100%", borderRadius: 2, overflow: "hidden" }}>
                  <Map
                    mode="dashboard"
                    refreshTrigger={0}
                    dashboardMarkers={dashboardMarkers}
                    onDashboardMarkerClick={handleMarkerClick}
                    goTo={selectedSubArea ? [selectedSubArea.lng, selectedSubArea.lat] : null}
                  />
                </Box>
              </Grid>
            </Grid>
          </Box>

          <CardCarousel
            subareas={filteredSubAreas}
            onSelect={(s) => router.push(`/configuration?savedLocationId=${s.id}`)}
            emptyTitle="No Sub-Areas Yet"
            emptyDescription="Enter explore mode and draw a sub-area to begin."
          />

          {allTags.length > 0 && (
            <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, fontWeight: 600 }}>
                Filter by road elements:
              </Typography>

              {allTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant={selectedTags.includes(tag) ? "filled" : "outlined"}
                  onClick={() => toggleTag(tag)}
                  sx={{
                    fontSize: "0.75rem",
                    height: 26,
                    cursor: "pointer",
                    ...(selectedTags.includes(tag)
                      ? {
                          bgcolor: "#1d1f3f",
                          color: "#fff",
                          "&:hover": { bgcolor: "#2a2d5a" },
                        }
                      : {
                          borderColor: "#999",
                          color: "#555",
                          "&:hover": { bgcolor: "#eee" },
                        }),
                  }}
                />
              ))}

              {selectedTags.length > 0 && (
                <Chip
                  label="Clear"
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectedTags([])}
                  sx={{ fontSize: "0.7rem", height: 24, borderColor: "#ccc", color: "#999" }}
                />
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}