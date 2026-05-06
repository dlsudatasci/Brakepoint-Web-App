"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback, Suspense } from "react";
import { Box, Typography, IconButton, Chip } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import { useRouter, useSearchParams } from "next/navigation";

import Timeline from "@components/timeline/timeline";
import Notification from "@/components/ui/notifications";

import "./style.css";

import dynamic from "next/dynamic";
import ModeSegmentedControl from "@/components/ui/modeToggle";
const Map = dynamic(() => import("@components/map/map"), { ssr: false });

export default function MonitoringPage() {
  return (
    <Suspense fallback={null}>
      <MonitoringContent />
    </Suspense>
  );
}

function MonitoringContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCameraId = searchParams.get("cameraId");

  const [allFeeds, setAllFeeds] = useState<any[]>([]);
  const [selectedFeedId, setSelectedFeedId] = useState<number | string | null>(initialCameraId ? Number(initialCameraId) : null);
  const selectedFeedIdRef = useRef<number | string | null>(initialCameraId ? Number(initialCameraId) : null);

  const [visibleCameraIds, setVisibleCameraIds] = useState<(number | string)[]>([]);

  const [camerasRefreshTrigger] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    selectedFeedIdRef.current = selectedFeedId;
  }, [selectedFeedId]);

  const selectedFeed = useMemo(
    () => (selectedFeedId == null ? null : (allFeeds.find((f) => String(f.id) === String(selectedFeedId)) ?? null)),
    [allFeeds, selectedFeedId],
  );

  const handleCameraClick = useCallback((cameraId: number | string) => {
    setSelectedFeedId((prev) => (String(prev) === String(cameraId) ? null : cameraId));
  }, []);

  const handleVisibleCamerasChange = useCallback((ids: (number | string)[]) => {
    setVisibleCameraIds(ids);
  }, []);


  const [goToTarget, setGoToTarget] = useState<[number, number] | null>(() => {
    if (!initialCameraId) return null;
    try {
      const raw = sessionStorage.getItem("bp_cameras_v1");
      if (!raw) return null;
      const cached = JSON.parse(raw);
      const target = cached.find((c: any) => String(c.id) === String(initialCameraId));
      if (target?.lng != null && target?.lat != null) return [target.lng, target.lat];
    } catch {}
    return null;
  });

  const handleCamerasLoaded = useCallback(
    (cameras: any[]) => {
      const formatted = cameras.map((cam: any) => ({
        id: cam.id,
        name: cam.name,
        lat: cam.lat,
        lng: cam.lng,
        location: cam.location,
        latestUpload: cam.latest_upload || "No uploads yet",
        vehicles: cam.vehicles || 0,
        occurrences: cam.occurrences || 0,
        behaviors: Array.isArray(cam.behaviors) && cam.behaviors.length > 0 ? cam.behaviors : ["No Data"],
        signs: cam.signs || 0,
        signClasses: cam.sign_classes || [],
        jeepneyHotspot: cam.latest_video?.jeepney_hotspot || false,
      }));

      setAllFeeds(formatted);

      // If a cameraId was passed via query param, fly to that camera
      if (initialCameraId) {
        const target = formatted.find((f) => String(f.id) === String(initialCameraId));
        if (target) {
          setGoToTarget([target.lng, target.lat]);
        }
      }

      if (selectedFeedIdRef.current != null && !formatted.some((f) => String(f.id) === String(selectedFeedIdRef.current))) {
        setSelectedFeedId(null);
      }
    },
    [initialCameraId],
  );

  useEffect(() => {
    if (!selectedFeed) return;

    setGoToTarget([selectedFeed.lng, selectedFeed.lat]);
  }, [selectedFeed]);

  /** Which camera IDs to feed into the timeline */
  const timelineCameraIds = useMemo(() => {
    if (selectedFeedId != null) return [selectedFeedId];
    return visibleCameraIds;
  }, [selectedFeedId, visibleCameraIds]);

  // ── Bottom drawer state ───────────────
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerHeight, setDrawerHeight] = useState(340);
  const isDragging = useRef(false);

  const MIN_H = 200;
  const MAX_H = typeof window !== "undefined" ? window.innerHeight * 0.7 : 600;

  useEffect(() => {
    const saved = localStorage.getItem("monitoringDrawerH");
    if (saved) setDrawerHeight(Math.min(Math.max(Number(saved), MIN_H), MAX_H));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      localStorage.setItem("monitoringDrawerH", drawerHeight.toString());
    }, 400);
    return () => clearTimeout(t);
  }, [drawerHeight]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const h = window.innerHeight - e.clientY;
      setDrawerHeight(Math.min(Math.max(h, MIN_H), MAX_H));
    };
    const onUp = () => {
      if (isDragging.current) {
        isDragging.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = () => {
    isDragging.current = true;
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";
  };

  if (isNavigating) {
    return (
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "#e8eaf6",
          zIndex: 9999,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <Box
            sx={{
              width: 48,
              height: 48,
              mx: "auto",
              mb: 2,
              border: "4px solid #e0e0e0",
              borderTop: "4px solid #161b4c",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <Typography sx={{ color: "#161b4c", fontWeight: 600 }}>Loading…</Typography>
        </Box>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100vh", width: "100vw", position: "relative", overflow: "hidden" }}>
      {/* ── Floating nav ──────────────────── */}
      <IconButton
        onClick={() => {
          setIsNavigating(true);
          router.push("/dashboard");
        }}
        sx={{
          position: "fixed",
          top: 16,
          left: 16,
          zIndex: 1001,
          bgcolor: "#fff",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18)",
          "&:hover": { bgcolor: "#f5f5f5" },
        }}
      >
        <ArrowBackIcon />
      </IconButton>

      <ModeSegmentedControl />

      {/* ── Full-screen map ───────────────── */}
      <Box sx={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <Map
          mode="heatmap"
          onCameraClick={handleCameraClick}
          onVisibleCamerasChange={handleVisibleCamerasChange}
          onCamerasLoaded={handleCamerasLoaded}
          selectedCameraId={selectedFeedId}
          refreshTrigger={camerasRefreshTrigger}
          goTo={goToTarget}
        />
      </Box>

      {/* ── Toggle button (always visible) ── */}
      <IconButton
        onClick={() => setDrawerOpen((prev) => !prev)}
        sx={{
          position: "fixed",
          bottom: drawerOpen ? drawerHeight : 0,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 30,
          bgcolor: "#fff",
          boxShadow: "0 -2px 6px rgba(0,0,0,0.15)",
          borderRadius: "16px 16px 0 0",
          width: 80,
          height: 28,
          transition: "bottom 0.35s cubic-bezier(0.4,0,0.2,1)",
          "&:hover": { bgcolor: "#f5f5f5" },
        }}
      >
        {drawerOpen ? <KeyboardArrowDownIcon /> : <KeyboardArrowUpIcon />}
      </IconButton>

      {/* ── Bottom drawer ─────────────────── */}
      <Box
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: drawerHeight,
          bgcolor: "#fff",
          boxShadow: "0 -4px 16px rgba(0,0,0,0.12)",
          borderRadius: "16px 16px 0 0",
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: drawerOpen ? "translateY(0)" : `translateY(100%)`,
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Drag handle */}
        <Box
          onMouseDown={startDrag}
          sx={{
            flex: "0 0 auto",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 20,
            cursor: "ns-resize",
            "&:hover .drag-pill": { bgcolor: "rgba(0,0,0,0.25)" },
          }}
        >
          <Box className="drag-pill" sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "rgba(0,0,0,0.15)", transition: "background 0.2s" }} />
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: "auto", px: { xs: 1.5, sm: 3 }, pb: 2 }}>
          {/* Context chip */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1d1f3f" }}>
              Monitoring
            </Typography>
            {selectedFeed ? (
              <Chip
                label={selectedFeed.name ?? `Camera ${selectedFeed.id}`}
                size="small"
                onDelete={() => setSelectedFeedId(null)}
                sx={{ bgcolor: "#1d1f3f", color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}
              />
            ) : (
              <Chip
                label={`${visibleCameraIds.length} camera${visibleCameraIds.length !== 1 ? "s" : ""} in view`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 500, fontSize: "0.75rem", marginLeft: "16px" }}
              />
            )}
          </Box>

          <Timeline cameraIds={timelineCameraIds} />
        </Box>
      </Box>
    </Box>
  );
}
