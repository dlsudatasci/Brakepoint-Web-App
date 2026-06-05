"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, CircularProgress, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SideMenu from "@/components/landing/sideMenu";
import type { SideMenuUpdater } from "@/components/landing/sideMenu";
import { authFetch } from "@/lib/authFetch";

import {
    SubAreaType, 
    AOISummary, SubAreaSummary, CameraSummary,
    isAreaSummary, isSubareaSummary, isCameraSummary,
    convertObjectToAreaSummary, convertObjectToSubareaSummary, convertObjectToCameraSummary
} from "@/components/landing/summaryTypes"

const Map = dynamic(() => import("@/components/map/map"), { ssr: false });

type AoiItem = { id: number; name: string; ring: [number, number][] };

export default function LandingPage() {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isDrawingSubarea, setIsDrawingSubarea] = useState<SubAreaType | false>(false);
  const isDrawingSubareaRef = useRef<SubAreaType | false>(false);
  isDrawingSubareaRef.current = isDrawingSubarea;
  const pendingSubAreaTypeRef = useRef<SubAreaType | null>(null);
  const [sideMenuTrigger, setSideMenuTrigger] = useState(0);
  const [aoiItems, setAoiItems] = useState<AoiItem[]>([]);
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);
  const [activeAoiId, setActiveAoiId] = useState<number | null>(null);
  const [hoveredSubAreaId, setHoveredSubAreaId] = useState<number | null>(null);
  const [selectedAoiId, setSelectedAoiId] = useState<number | null>(null);
  const selectedAoiIdRef = useRef<number | null>(null);
  selectedAoiIdRef.current = selectedAoiId;
  const aoiItemsRef = useRef(aoiItems);
  aoiItemsRef.current = aoiItems;
  const isDrawingRef = useRef(false);
  isDrawingRef.current = isDrawing || isDrawingSubarea !== false;
  const [aoiBounds, setAoiBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [subAreaItems, setSubAreaItems] = useState<AoiItem[]>([]);
  const [activeSubAreaId, setActiveSubAreaId] = useState<number | null>(null);
  const [selectedSubareaId, setSelectedSubareaId] = useState<number | null>(null);
  const selectedSubareaIdRef = useRef<number | null>(null);
  selectedSubareaIdRef.current = selectedSubareaId;
  const [subareaBounds, setSubareaBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [atCameraLevel, setAtCameraLevel] = useState(false);
  const [atCameraDetailLevel, setAtCameraDetailLevel] = useState(false);
  const [selectedCameraMapId, setSelectedCameraMapId] = useState<number | null>(null);
  const [subareaCameraIds, setSubareaCameraIds] = useState<number[] | null>(null);
  const [isPlacingCamera, setIsPlacingCamera] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  // Edit-dialog state
  const [editAoi, setEditAoi] = useState<AoiItem | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AOI delete confirmation state
  const [deleteConfirmAoi, setDeleteConfirmAoi] = useState<AoiItem | null>(null);

  // Sub-area edit-dialog state
  const [editSubarea, setEditSubarea] = useState<AoiItem | null>(null);
  const [editSubareaName, setEditSubareaName] = useState("");
  const [savingSubarea, setSavingSubarea] = useState(false);
  const [deletingSubarea, setDeletingSubarea] = useState(false);

  // Sub-area delete confirmation state
  const [deleteConfirmSubArea, setDeleteConfirmSubArea] = useState<AoiItem | null>(null);

  // Direct updater for SideMenu sub-area list
  const sideMenuUpdaterRef = useRef<SideMenuUpdater | null>(null);

  // Loading state
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Feed tab active state
  const [isFeedTabActive, setIsFeedTabActive] = useState(false);

  // function to force update the side menu from anywhere
  const updateSideMenu = () => { setSideMenuTrigger(sideMenuTrigger + 1); }

  // Initial fetch
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
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsMapLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Auto-clear draw error after 4 seconds
  useEffect(() => {
    if (!drawError) return;
    const t = setTimeout(() => setDrawError(null), 4000);
    return () => clearTimeout(t);
  }, [drawError]);

  // called once user finished drawing an AoI on the map
  const handleAoiDrawn = useCallback(async (ring: [number, number][], clearDrawing: () => void) => {
    sideMenuUpdaterRef.current?.setLoading(true); // side menu begins loading; will be cleared by sideMenu functions
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

    // shunt this way if we're drawing a subarea (if there is a parent attached to this creation)
    if (parentId != null) {
      // Validate that the drawn polygon is within the AOI's bounding box
      const parentAoiData = aoiItemsRef.current.find((a) => a.id === parentId);
      if (parentAoiData) {
        const aoiLngs = parentAoiData.ring.map((p) => p[0]);
        const aoiLats = parentAoiData.ring.map((p) => p[1]);
        const aoiMinLng = Math.min(...aoiLngs), aoiMaxLng = Math.max(...aoiLngs);
        const aoiMinLat = Math.min(...aoiLats), aoiMaxLat = Math.max(...aoiLats);
        const [subMinLng, subMinLat] = bounds[0] as [number, number];
        const [subMaxLng, subMaxLat] = bounds[1] as [number, number];
        if (subMinLng < aoiMinLng || subMinLat < aoiMinLat || subMaxLng > aoiMaxLng || subMaxLat > aoiMaxLat) {
          clearDrawing();
          setIsDrawingSubarea(false);
          setDrawError("Polygon must be within the AOI boundaries.");
          return;
        }
      }

      // Drawing a road segment inside an AOI
      const subAreaType = (pendingSubAreaTypeRef.current ?? isDrawingSubareaRef.current) || "road_segment";
      pendingSubAreaTypeRef.current = null;
      const tempId = -(Date.now());
      setSubAreaItems((prev) => [...prev, { id: tempId, name: "New Segment", ring }]);
      clearDrawing();
      setIsDrawingSubarea(false);

      // default name depends on subarea type
      let defaultName = "New subarea";
      switch(subAreaType) {
        case "intersection":  defaultName = "New intersection"; break;
        case "junction":      defaultName = "New junction";     break;
        case "road_segment":  defaultName = "New segment";      break;
      }

      try {
        // POST to api to create this subarea
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: defaultName,
            lat: centroid.lat,
            lng: centroid.lng,
            geometry: ring,
            bounds,
            location_type: "sub_area",
            sub_area_type: subAreaType,
            parent_id: parentId,
          }),
        });
        if (!res.ok) throw new Error(await res.text()); // quickfail
        const saved = await res.json();
        const realId: number = saved?.saved_location?.id ?? tempId;
        
        // update local variables
        setSubAreaItems((prev) => prev.map((s) =>
          s.id === tempId ? { id: realId, name: "New Segment", ring } : s
        ));
        sideMenuUpdaterRef.current?.createObject(convertObjectToSubareaSummary({
          id: realId,
          name: "New Segment",
          lat: centroid.lat,
          lng: centroid.lng,
          camera_count: 0,
          subarea_count: 0,
          vehicles: 0,
          adb: 0,
          speeding: 0,
          swerving: 0,
          abrupt_stopping: 0,
          tags: [],
          vehicle_breakdown: {},
          sub_area_type: subAreaType,
        }), parentId)

      } catch (err) {
        console.error("Failed to save sub-area:", err);
      sideMenuUpdaterRef.current?.setLoading(false); // side menu stops loading
        setSubAreaItems((prev) => prev.filter((s) => s.id !== tempId));
      }
    } else {
      // Drawing an AOI
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
        updateSideMenu()
      } catch (err) {
        console.error("Failed to save AOI:", err);
        sideMenuUpdaterRef.current?.setLoading(false); // side menu begins loading
        setAoiItems((prev) => prev.filter((a) => a.id !== tempId));
      }
    }
  }, []);

  const handleAoiClick = useCallback((id: number) => {
    if (isDrawingRef.current) return;
    if (selectedAoiIdRef.current != null) return; // in sub-level view the AOI is displayed as context only — ignore clicks
    setActiveAoiId((prev) => prev === id ? null : id);
  }, []);

  const handleAoiEdit = useCallback((id: number) => {
    const aoi = aoiItems.find((a) => a.id === id);
    if (!aoi) return;
    setEditAoi(aoi);
    setEditName(aoi.name);
  }, [aoiItems]);

  const handleAoiDelete = useCallback((id: number) => {
    const aoi = aoiItems.find((a) => a.id === id);
    if (!aoi) return;
    setDeleteConfirmAoi(aoi);
  }, [aoiItems]);

  const handleSubAreaClick = useCallback((id: number) => {
    if (isDrawingRef.current) return;
    setActiveSubAreaId((prev) => prev === id ? null : id);
  }, []);

  const handleSubAreaEdit = useCallback((id: number) => {
    const sub = subAreaItems.find((s) => s.id === id);
    if (!sub) return;
    setEditSubarea(sub);
    setEditSubareaName(sub.name);
  }, [subAreaItems]);

  const handleSubAreaDelete = useCallback((id: number) => {
    const sub = subAreaItems.find((s) => s.id === id);
    if (!sub) return;
    setDeleteConfirmSubArea(sub);
  }, [subAreaItems]);

  const handleSubareaClick = useCallback((id: number, _name: string) => {
    if (isDrawingRef.current) return;
    setActiveSubAreaId((prev) => prev === id ? null : id);
  }, []);

  const handleSaveSubareaName = async () => {
    if (!editSubarea) return;
    const target = editSubarea;
    const newName = editSubareaName.trim() || target.name;
    sideMenuUpdaterRef.current?.setLoading(true); // side menu begins loading; will be cleared by sideMenu functions

    setSubAreaItems((prev) => prev.map((s) => s.id === target.id ? { ...s, name: newName } : s));
    // sideMenuUpdaterRef.current?.renameObject("subarea", target.id, target.name);
    setEditSubarea(null);
    setActiveSubAreaId(null);

    setSavingSubarea(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text()); // quickfail shunt
      sideMenuUpdaterRef.current?.renameObject("subarea", target.id, newName);

    } catch (err) {
      console.error("Failed to rename road segment:", err);
      sideMenuUpdaterRef.current?.setLoading(false); // side menu stops loading
      setSubAreaItems((prev) => prev.map((s) => s.id === target.id ? { ...s, name: target.name } : s));
    // sideMenuUpdaterRef.current?.renameObject("subarea", target.id, target.name);
    } finally {
      setSavingSubarea(false);
    }
  };

  const handleDeleteSubarea = async () => {
    if (!deleteConfirmSubArea) return;
    const target = deleteConfirmSubArea;
    sideMenuUpdaterRef.current?.setLoading(true); // side menu begins loading; will be cleared by sideMenu functions

    setSubAreaItems((prev) => prev.filter((s) => s.id !== target.id));
    // sideMenuUpdaterRef.current?.deleteSubarea(target.id);
    setDeleteConfirmSubArea(null);
    setActiveSubAreaId(null);

    setDeletingSubarea(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text()); // throw error and shunt out
      sideMenuUpdaterRef.current?.deleteObject("subarea", target.id)

    } catch (err) {
      console.error("Failed to delete subarea:", err);
      setSubAreaItems((prev) => [...prev, { id: target.id, name: target.name, ring: target.ring }]);
      // sideMenuUpdaterRef.current?.deleteSubarea(target.id, target.name);
      sideMenuUpdaterRef.current?.setLoading(false); // side menu stops loading
      updateSideMenu()
    } finally {
      setDeletingSubarea(false);
    }
  };

  const handleAoiEnter = useCallback(async (aoi: { id: number }) => {
    const aoiData = aoiItems.find((a) => a.id === aoi.id);
    if (!aoiData || aoiData.ring.length < 3) return;

    const lngs = aoiData.ring.map((p) => p[0]);
    const lats  = aoiData.ring.map((p) => p[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats),  maxLat = Math.max(...lats);

    setSelectedAoiId(aoi.id);
    setAoiBounds([[minLng, minLat], [maxLng, maxLat]]);

    setIsMapLoading(true);
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
    } finally {
      setIsMapLoading(false);
    }
  }, [aoiItems]);

  const handleAoiBack = useCallback(() => {
    setSelectedAoiId(null);
    setSelectedSubareaId(null);
    setAoiBounds(null);
    setSubareaBounds(null);
    setSubAreaItems([]);
    setIsDrawingSubarea(false);
    setActiveSubAreaId(null);
  }, []);

  const handleSelectSubarea = useCallback((id: number, cameraIds: number[]) => {
    setSelectedSubareaId(id);
    setAtCameraLevel(true);
    setAtCameraDetailLevel(false);
    setSelectedCameraMapId(null);
    setIsPlacingCamera(false);
    setSubareaCameraIds(cameraIds);
    setSubAreaItems((prev) => {
      const sub = prev.find((s) => s.id === id);
      if (sub && sub.ring.length >= 3) {
        const lngs = sub.ring.map((p) => p[0]);
        const lats = sub.ring.map((p) => p[1]);
        setSubareaBounds([[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]]);
      }
      return prev;
    });
  }, []);

  const handleSubareaBack = useCallback(() => {
    setSelectedSubareaId(null);
    setAtCameraLevel(false);
    setAtCameraDetailLevel(false);
    setSelectedCameraMapId(null);
    setSubareaCameraIds(null);
    setIsPlacingCamera(false);
    setSubareaBounds(null);
    setAoiBounds((prev) => prev ? [[prev[0][0], prev[0][1]], [prev[1][0], prev[1][1]]] : null);
  }, []);

  const handleCameraEnter = useCallback((camera: CameraSummary) => {
    setAtCameraDetailLevel(true);
    setSelectedCameraMapId(camera.id);
    setIsPlacingCamera(false);
  }, []);
  const handleCameraBack = useCallback(() => {
    setAtCameraDetailLevel(false);
    setSelectedCameraMapId(null);
    setIsFeedTabActive(false);
  }, []);

  const handleAddCamera = useCallback(() => setIsPlacingCamera((d) => !d), []);
  const handleCameraAdded = useCallback((_id: number, _lat: number, _lng: number, camera: Record<string, any>) => {
    setIsPlacingCamera(false);
    setSubareaCameraIds((prev) => [...(prev ?? []), _id]);
    if (selectedSubareaIdRef.current != null) {
      sideMenuUpdaterRef.current?.addCamera(
        convertObjectToCameraSummary(camera),
        selectedSubareaIdRef.current,
      );
    }
  }, []);
  const handleCameraPlacedOutside = useCallback(() => {
    setDrawError("Camera must be placed within the sub-area boundaries.");
  }, []);

  const handleAddSubarea = useCallback((type: SubAreaType) => {
    setIsDrawingSubarea((d) => {
      const next = d === type ? false : type;
      pendingSubAreaTypeRef.current = next || null;
      return next;
    });
    setIsDrawing(false);
  }, []);

  const handleEditClose = () => { setEditAoi(null); setActiveAoiId(null); };

  const handleSaveName = async () => {
    if (!editAoi) return;
    const target = editAoi;
    const newName = editName.trim() || target.name;
    
    setAoiItems((prev) => prev.map((a) => a.id === target.id ? { ...a, name: newName } : a));
    setEditAoi(null);
    setActiveAoiId(null);

    setSaving(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      if (!res.ok) throw new Error(await res.text());
      updateSideMenu()
    } catch (err) {
      console.error("Failed to rename AOI:", err);
      setAoiItems((prev) => prev.map((a) => a.id === target.id ? { ...a, name: target.name } : a)); // revert
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAoi) return;
    const target = deleteConfirmAoi;

    setAoiItems((prev) => prev.filter((a) => a.id !== target.id));
    setDeleteConfirmAoi(null);
    setActiveAoiId(null);

    setDeleting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      updateSideMenu()
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
          refreshTrigger={sideMenuTrigger}
          hideEditControls={!isFeedTabActive}
          cleanMap={selectedSubareaId == null}
          showGeocoder
          isDrawingAOI={isDrawing || isDrawingSubarea !== false}
          onAoiDrawn={handleAoiDrawn}
          aoiItems={selectedSubareaId != null ? ([] as AoiItem[]) : selectedAoiId != null ? aoiItems.filter((a) => a.id === selectedAoiId) : aoiItems}
          hoveredAoiId={hoveredAoiId}
          activeAoiId={activeAoiId}
          onAoiClick={handleAoiClick}
          onAoiEdit={handleAoiEdit}
          onAoiDelete={handleAoiDelete}
          goToBounds={subareaBounds ?? aoiBounds}
          goToBoundsPadding={{ top: 60, right: 60, bottom: 60, left: 410 }}
          hideAoiMarkers={selectedAoiId != null}
          subAreaItems={
            selectedSubareaId != null
              ? subAreaItems.filter((s) => s.id === selectedSubareaId)
              : subAreaItems.length > 0 ? subAreaItems : null
          }
          hideSubAreaMarkers={atCameraLevel}
          disableSubAreaInteraction={atCameraLevel}
          hoveredSubAreaId={hoveredSubAreaId}
          activeSubAreaId={activeSubAreaId}
          onSubAreaClick={handleSubAreaClick}
          onSubAreaEdit={handleSubAreaEdit}
          onSubAreaDelete={handleSubAreaDelete}
          onSubAreaHover={(id) => setHoveredSubAreaId(id)}
          isPlacingCamera={isPlacingCamera}
          cameraParentLocationId={selectedSubareaId}
          selectedCameraId={selectedCameraMapId}
          visibleCameraIds={selectedSubareaId != null ? (subareaCameraIds ?? []) : []}
          hideCameraPolygons={!atCameraDetailLevel}
          onCameraClick={(id) => {
            const cameraId = typeof id === "number" ? id : parseInt(id, 10);
            if (!Number.isNaN(cameraId)) {
              sideMenuUpdaterRef.current?.selectCamera(cameraId);
            }
          }}
          onCameraAdd={handleCameraAdded}
          onCameraPlacedOutside={handleCameraPlacedOutside}
        />
      </Box>

      {/* SideMenu */}
      <Box sx={{ position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <SideMenu
          refreshTrigger={sideMenuTrigger}
          onMount={(updater) => { sideMenuUpdaterRef.current = updater; }}

          onAoiHover={(id) => setHoveredAoiId(id)}
          onAoiClick={handleAoiClick}
          onAoiEnter={handleAoiEnter}
          onAoiBack={handleAoiBack}
          onAddArea={() => setIsDrawing((d) => !d)}
          onRenameAoi = {handleAoiEdit}
          onDeleteAoi = {handleAoiDelete}
          isDrawingAOI={isDrawing}

          onSelectSubarea={handleSelectSubarea}
          onSubareaHover={(id) => setHoveredSubAreaId(id)}
          onSubareaClick={handleSubareaClick}
          onSubareaBack={handleSubareaBack}
          onRenameSubarea = {handleSubAreaEdit}
          onDeleteSubarea = {handleSubAreaDelete}
          onAddSubarea={handleAddSubarea}
          isDrawingSubarea={isDrawingSubarea}

          onCameraClick={(id) => sideMenuUpdaterRef.current?.selectCamera(id)}
          onCameraEnter={handleCameraEnter}
          onCameraBack={handleCameraBack}
          onAddCamera={handleAddCamera}
          isDrawingCamera={isPlacingCamera}

          onFeedTabActive={setIsFeedTabActive}
        />
      </Box>

      {/* Loading overlay - disabled currently */}
      {false && isMapLoading && (
        <Box sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5',
          zIndex: 9999,
        }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{
              width: 50,
              height: 50,
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #161b4cff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px',
            }} />
            <Typography variant="h6" style={{ color: '#161b4cff' }}>Loading...</Typography>
          </Box>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </Box>
      )}

      {/* Draw error toast */}
      {drawError && (
        <Box sx={{
          position: "fixed",
          bottom: 24,
          left: "50%",
          transform: "translateX(-50%)",
          bgcolor: "#b91c1c",
          color: "#fff",
          px: 3,
          py: 1.5,
          borderRadius: "10px",
          fontWeight: 600,
          fontSize: 14,
          boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
          zIndex: 10000,
          pointerEvents: "none",
        }}>
          {drawError}
        </Box>
      )}

      {/* AOI rename dialog */}
      <Dialog
        open={editAoi !== null}
        onClose={handleEditClose}
        PaperProps={{
          sx: { borderRadius: "14px", minWidth: 340, p: 0.5 },
        }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Rename Area</Typography>
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

        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={handleEditClose} sx={{ textTransform: "none", color: "#555" }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveName}
            disabled={saving}
            variant="contained"
            sx={{ bgcolor: "#1d1f3f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#11153f" } }}
          >
            {saving ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AOI delete confirmation dialog */}
      <Dialog
        open={deleteConfirmAoi !== null}
        onClose={() => setDeleteConfirmAoi(null)}
        PaperProps={{ sx: { borderRadius: "14px", minWidth: 300, p: 0.5 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Delete Area</Typography>
          <IconButton size="small" onClick={() => setDeleteConfirmAoi(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ color: "#444" }}>
            Delete &ldquo;{deleteConfirmAoi?.name}&rdquo;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => setDeleteConfirmAoi(null)} sx={{ textTransform: "none", color: "#555" }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            disabled={deleting}
            variant="contained"
            sx={{ bgcolor: "#d32f2f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#b71c1c" } }}
          >
            {deleting ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Road segment rename dialog */}
      <Dialog
        open={editSubarea !== null}
        onClose={() => setEditSubarea(null)}
        PaperProps={{ sx: { borderRadius: "14px", minWidth: 340, p: 0.5 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Rename Road Segment</Typography>
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

        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => setEditSubarea(null)} sx={{ textTransform: "none", color: "#555" }}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSubareaName}
            disabled={savingSubarea}
            variant="contained"
            sx={{ bgcolor: "#1d1f3f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#11153f" } }}
          >
            {savingSubarea ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Road segment delete confirmation dialog */}
      <Dialog
        open={deleteConfirmSubArea !== null}
        onClose={() => setDeleteConfirmSubArea(null)}
        PaperProps={{ sx: { borderRadius: "14px", minWidth: 300, p: 0.5 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Delete Road Segment</Typography>
          <IconButton size="small" onClick={() => setDeleteConfirmSubArea(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ color: "#444" }}>
            Delete &ldquo;{deleteConfirmSubArea?.name}&rdquo;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={() => setDeleteConfirmSubArea(null)} sx={{ textTransform: "none", color: "#555" }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteSubarea}
            disabled={deletingSubarea}
            variant="contained"
            sx={{ bgcolor: "#d32f2f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#b71c1c" } }}
          >
            {deletingSubarea ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}