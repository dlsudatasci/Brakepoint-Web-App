"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, CircularProgress, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SideMenu from "@/components/landing/sideMenu";
import { authFetch } from "@/lib/authFetch";

const Map = dynamic(() => import("@/components/map/map"), { ssr: false });

type AoiItem = { id: number; name: string; ring: [number, number][] };

export default function LandingPage() {
  const [isDrawing, setIsDrawing] = useState(false);
  // sideMenuTrigger is ONLY for refreshing the SideMenu list; aoiItems on the
  // map are managed locally via optimistic updates so they never wait for a
  // round-trip fetch to appear.
  const [sideMenuTrigger, setSideMenuTrigger] = useState(0);
  const [aoiItems, setAoiItems] = useState<AoiItem[]>([]);
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);

  // Edit-dialog state
  const [editAoi, setEditAoi] = useState<AoiItem | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Initial fetch — runs once on mount; all subsequent changes are optimistic.
  useEffect(() => {
    let cancelled = false;
    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=aoi`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const locations: any[] = Array.isArray(data?.saved_locations) ? data.saved_locations : [];
        const items: AoiItem[] = locations
          .filter((loc) => Array.isArray(loc.geometry) && loc.geometry.length >= 3)
          .map((loc) => ({ id: loc.id as number, name: loc.name as string, ring: loc.geometry as [number, number][] }));
        setAoiItems(items);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []); // empty deps — mount only

  const handleAoiDrawn = useCallback(async (ring: [number, number][], clearDrawing: () => void) => {
    const lngs = ring.map((p) => p[0]);
    const lats = ring.map((p) => p[1]);
    const centroid = {
      lng: lngs.reduce((s, v) => s + v, 0) / lngs.length,
      lat: lats.reduce((s, v) => s + v, 0) / lats.length,
    };
    const bounds = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    // Show the polygon on the map immediately with a temporary negative id.
    const tempId = -(Date.now());
    setAoiItems((prev) => [...prev, { id: tempId, name: "New Area", ring }]);
    clearDrawing();
    setIsDrawing(false);

    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "New Area",
          lat: centroid.lat,
          lng: centroid.lng,
          geometry: ring,
          bounds,
          location_type: "aoi",
          parent_id: null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const saved = await res.json();
      const realId: number = saved?.saved_location?.id ?? tempId;
      // Swap temp id for the real server-assigned id.
      setAoiItems((prev) => prev.map((a) =>
        a.id === tempId ? { id: realId, name: "New Area", ring } : a
      ));
      setSideMenuTrigger((n) => n + 1);
    } catch (err) {
      console.error("Failed to save AOI:", err);
      setAoiItems((prev) => prev.filter((a) => a.id !== tempId)); // revert
    }
  }, []);

  const handleAoiClick = useCallback((id: number) => {
    const aoi = aoiItems.find((a) => a.id === id);
    if (!aoi) return;
    setEditAoi(aoi);
    setEditName(aoi.name);
  }, [aoiItems]);

  const handleEditClose = () => { setEditAoi(null); };

  const handleSaveName = async () => {
    if (!editAoi) return;
    const target = editAoi;
    const newName = editName.trim() || target.name;

    // Optimistic: update immediately and close dialog.
    setAoiItems((prev) => prev.map((a) => a.id === target.id ? { ...a, name: newName } : a));
    setEditAoi(null);

    setSaving(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSideMenuTrigger((n) => n + 1);
    } catch (err) {
      console.error("Failed to rename AOI:", err);
      setAoiItems((prev) => prev.map((a) => a.id === target.id ? { ...a, name: target.name } : a)); // revert
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editAoi) return;
    const target = editAoi;

    // Optimistic: remove immediately and close dialog.
    setAoiItems((prev) => prev.filter((a) => a.id !== target.id));
    setEditAoi(null);

    setDeleting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      setSideMenuTrigger((n) => n + 1);
    } catch (err) {
      console.error("Failed to delete AOI:", err);
      setAoiItems((prev) => [...prev, { id: target.id, name: target.name, ring: target.ring }]); // revert
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Full-screen map */}
      <Box sx={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0 }}>
        <Map
          mode="map"
          refreshTrigger={0}
          hideEditControls
          cleanMap
          showGeocoder
          isDrawingAOI={isDrawing}
          onAoiDrawn={handleAoiDrawn}
          aoiItems={aoiItems}
          hoveredAoiId={hoveredAoiId}
          onAoiClick={handleAoiClick}
        />
      </Box>

      {/* SideMenu — always visible */}
      <Box sx={{ position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <SideMenu
          onAddArea={() => setIsDrawing((d) => !d)}
          isDrawingAOI={isDrawing}
          onAoiHover={(id) => setHoveredAoiId(id)}
          onAoiClick={handleAoiClick}
          refreshTrigger={sideMenuTrigger}
        />
      </Box>

      {/* AOI edit dialog */}
      <Dialog
        open={editAoi !== null}
        onClose={handleEditClose}
        PaperProps={{
          sx: { borderRadius: "14px", minWidth: 340, p: 0.5 },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Edit Area</Typography>
          <IconButton size="small" onClick={handleEditClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
            fullWidth
            size="small"
            autoFocus
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "space-between" }}>
          <Button
            onClick={handleDelete}
            disabled={deleting || saving}
            startIcon={deleting ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
            sx={{ color: "#d32f2f", textTransform: "none" }}
          >
            Delete
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={handleEditClose} sx={{ textTransform: "none", color: "#555" }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveName}
              disabled={saving || deleting}
              variant="contained"
              sx={{ bgcolor: "#1d1f3f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#11153f" } }}
            >
              {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}