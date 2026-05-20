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
import type { SideMenuUpdater } from "@/components/landing/sideMenu";
import { authFetch } from "@/lib/authFetch";

const Map = dynamic(() => import("@/components/map/map"), { ssr: false });

type AoiItem = { id: number; name: string; ring: [number, number][] };

export default function LandingPage() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawingSubarea, setIsDrawingSubarea] = useState(false);
  const [sideMenuTrigger, setSideMenuTrigger] = useState(0);
  const [aoiItems, setAoiItems] = useState<AoiItem[]>([]);
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);
  const [hoveredSubAreaId, setHoveredSubAreaId] = useState<number | null>(null);

  // Selected AOI state (when the user clicks the arrow on an AOI card)
  const [selectedAoiId, setSelectedAoiId] = useState<number | null>(null);
  // Sync ref so handleAoiDrawn (useCallback) can always read the latest value
  const selectedAoiIdRef = useRef<number | null>(null);
  selectedAoiIdRef.current = selectedAoiId;
  // Guard ref: true while any drawing mode is active — used to suppress polygon click dialogs
  const isDrawingRef = useRef(false);
  isDrawingRef.current = isDrawing || isDrawingSubarea;
  const [aoiBounds, setAoiBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [aoiMaxBounds, setAoiMaxBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [subAreaItems, setSubAreaItems] = useState<AoiItem[]>([]);

  // Edit-dialog state
  const [editAoi, setEditAoi] = useState<AoiItem | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Sub-area edit-dialog state
  const [editSubarea, setEditSubarea] = useState<AoiItem | null>(null);
  const [editSubareaName, setEditSubareaName] = useState("");
  const [savingSubarea, setSavingSubarea] = useState(false);
  const [deletingSubarea, setDeletingSubarea] = useState(false);

  // Direct updater for SideMenu sub-area list (avoids full API refetch on edit/delete)
  const sideMenuUpdaterRef = useRef<SideMenuUpdater | null>(null);

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

    const parentId = selectedAoiIdRef.current;

    if (parentId != null) {
      // ── Drawing a road segment inside an AOI ──────────────────────────────
      const tempId = -(Date.now());
      setSubAreaItems((prev) => [...prev, { id: tempId, name: "New Segment", ring }]);
      clearDrawing();
      setIsDrawingSubarea(false);

      try {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "New Segment",
            lat: centroid.lat,
            lng: centroid.lng,
            geometry: ring,
            bounds,
            location_type: "sub_area",
            parent_id: parentId,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
        const saved = await res.json();
        const realId: number = saved?.saved_location?.id ?? tempId;
        setSubAreaItems((prev) => prev.map((s) =>
          s.id === tempId ? { id: realId, name: "New Segment", ring } : s
        ));
        setSideMenuTrigger((n) => n + 1);
      } catch (err) {
        console.error("Failed to save sub-area:", err);
        setSubAreaItems((prev) => prev.filter((s) => s.id !== tempId));
      }
    } else {
      // ── Drawing an AOI ────────────────────────────────────────────────────
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
        setAoiItems((prev) => prev.map((a) =>
          a.id === tempId ? { id: realId, name: "New Area", ring } : a
        ));
        setSideMenuTrigger((n) => n + 1);
      } catch (err) {
        console.error("Failed to save AOI:", err);
        setAoiItems((prev) => prev.filter((a) => a.id !== tempId));
      }
    }
  }, []);

  const handleAoiClick = useCallback((id: number) => {
    if (isDrawingRef.current) return; // never open edit dialog while drawing
    const aoi = aoiItems.find((a) => a.id === id);
    if (!aoi) return;
    setEditAoi(aoi);
    setEditName(aoi.name);
  }, [aoiItems]);

  const handleSubareaClick = useCallback((id: number, name: string) => {
    if (isDrawingRef.current) return; // never open edit dialog while drawing
    const ring = subAreaItems.find((s) => s.id === id)?.ring ?? [];
    setEditSubarea({ id, name, ring });
    setEditSubareaName(name);
  }, [subAreaItems]);

  const handleSaveSubareaName = async () => {
    if (!editSubarea) return;
    const target = editSubarea;
    const newName = editSubareaName.trim() || target.name;

    setSubAreaItems((prev) => prev.map((s) => s.id === target.id ? { ...s, name: newName } : s));
    sideMenuUpdaterRef.current?.renameSubarea(target.id, newName);
    setEditSubarea(null);

    setSavingSubarea(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to rename road segment:", err);
      setSubAreaItems((prev) => prev.map((s) => s.id === target.id ? { ...s, name: target.name } : s));
      sideMenuUpdaterRef.current?.renameSubarea(target.id, target.name);
    } finally {
      setSavingSubarea(false);
    }
  };

  const handleDeleteSubarea = async () => {
    if (!editSubarea) return;
    const target = editSubarea;

    setSubAreaItems((prev) => prev.filter((s) => s.id !== target.id));
    sideMenuUpdaterRef.current?.deleteSubarea(target.id);
    setEditSubarea(null);

    setDeletingSubarea(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
    } catch (err) {
      console.error("Failed to delete road segment:", err);
      setSubAreaItems((prev) => [...prev, { id: target.id, name: target.name, ring: target.ring }]);
      sideMenuUpdaterRef.current?.renameSubarea(target.id, target.name); // re-add via rename to restore name
      setSideMenuTrigger((n) => n + 1); // full refetch to restore the deleted card
    } finally {
      setDeletingSubarea(false);
    }
  };

  const handleAoiEnter = useCallback(async (aoi: { id: number }) => {    const aoiData = aoiItems.find((a) => a.id === aoi.id);
    if (!aoiData || aoiData.ring.length < 3) return;

    const lngs = aoiData.ring.map((p) => p[0]);
    const lats  = aoiData.ring.map((p) => p[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
    const dLng = maxLng - minLng, dLat = maxLat - minLat;

    setSelectedAoiId(aoi.id);
    setAoiBounds([[minLng, minLat], [maxLng, maxLat]]);
    // Padded max-bounds: allow panning ~1× the AOI size in each direction
    setAoiMaxBounds([
      [minLng - dLng, minLat - dLat],
      [maxLng + dLng, maxLat + dLat],
    ]);

    try {
      const res = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=sub_area&parent_id=${aoi.id}`
      );
      const data = await res.json();
      const locs: any[] = Array.isArray(data?.saved_locations) ? data.saved_locations : [];
      setSubAreaItems(
        locs
          .filter((l) => Array.isArray(l.geometry) && l.geometry.length >= 3)
          .map((l) => ({ id: l.id as number, name: l.name as string, ring: l.geometry as [number, number][] }))
      );
    } catch (err) {
      console.error("Failed to fetch sub-areas:", err);
    }
  }, [aoiItems]);

  const handleAoiBack = useCallback(() => {
    setSelectedAoiId(null);
    setAoiBounds(null);
    setAoiMaxBounds(null);
    setSubAreaItems([]);
    setIsDrawingSubarea(false);
  }, []);

  const handleAddSubarea = useCallback(() => {
    setIsDrawingSubarea((d) => !d);
    setIsDrawing(false);
  }, []);

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
          isDrawingAOI={isDrawing || isDrawingSubarea}
          onAoiDrawn={handleAoiDrawn}
          aoiItems={selectedAoiId != null ? [] : aoiItems}
          hoveredAoiId={hoveredAoiId}
          onAoiClick={handleAoiClick}
          goToBounds={aoiBounds}
          mapMaxBounds={aoiMaxBounds}
          subAreaItems={subAreaItems.length > 0 ? subAreaItems : null}
          hoveredSubAreaId={hoveredSubAreaId}
          onSubAreaClick={(id) => {
            const sub = subAreaItems.find((s) => s.id === id);
            if (sub) handleSubareaClick(sub.id, sub.name);
          }}
          onSubAreaHover={(id) => setHoveredSubAreaId(id)}
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
          onAoiEnter={handleAoiEnter}
          onAoiBack={handleAoiBack}
          onAddSubarea={handleAddSubarea}
          isDrawingSubarea={isDrawingSubarea}
          onSubareaHover={(id) => setHoveredSubAreaId(id)}
          onSubareaClick={handleSubareaClick}
          onMount={(updater) => { sideMenuUpdaterRef.current = updater; }}
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

      {/* Road segment edit dialog */}
      <Dialog
        open={editSubarea !== null}
        onClose={() => setEditSubarea(null)}
        PaperProps={{ sx: { borderRadius: "14px", minWidth: 340, p: 0.5 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Edit Road Segment</Typography>
          <IconButton size="small" onClick={() => setEditSubarea(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: "8px !important" }}>
          <TextField
            label="Name"
            value={editSubareaName}
            onChange={(e) => setEditSubareaName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveSubareaName(); }}
            fullWidth
            size="small"
            autoFocus
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "8px" } }}
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "space-between" }}>
          <Button
            onClick={handleDeleteSubarea}
            disabled={deletingSubarea || savingSubarea}
            startIcon={deletingSubarea ? <CircularProgress size={14} /> : <DeleteOutlineIcon />}
            sx={{ color: "#d32f2f", textTransform: "none" }}
          >
            Delete
          </Button>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={() => setEditSubarea(null)} sx={{ textTransform: "none", color: "#555" }}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveSubareaName}
              disabled={savingSubarea || deletingSubarea}
              variant="contained"
              sx={{ bgcolor: "#1d1f3f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#11153f" } }}
            >
              {savingSubarea ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>
    </Box>
  );
}