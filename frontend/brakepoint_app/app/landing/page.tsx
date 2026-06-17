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
	SubAreaType, SummaryType, VehicleBreakdown,
	LocationSummary, AOISummary, SubAreaSummary, CameraSummary,
	isAreaSummary, isSubareaSummary, isCameraSummary,
	convertObjectToAreaSummary, convertObjectToSubareaSummary, convertObjectToCameraSummary,
	VideoSummary, convertObjectToVideoSummary,
  AOIRecord, SubareaRecord, CameraRecord, VideoRecord,
  convertRecordToArray,
} from "@/components/landing/summaryTypes";
import { Cameraswitch } from "@mui/icons-material";

const Map = dynamic(() => import("@/components/map/map"), { ssr: false });

type AoiItem = { id: number; name: string; ring: [number, number][] };

export default function LandingPage() {

  // stores all AOIs, subareas, cameras, and videos respectively
  const [allAois, setAllAois] = useState<AOIRecord>({});
  const [allSubareas, setAllSubareas] = useState<SubareaRecord>({});
  const [allCameras, setAllCameras] = useState<CameraRecord>({});
  const [allVideos, setAllVideos] = useState<VideoRecord>({});
  
  const allAoisRef = useRef<AOIRecord>({});
  allAoisRef.current = allAois;
  const allSubareasRef = useRef<SubareaRecord>({});
  allSubareasRef.current = allSubareas;
  const allCamerasRef = useRef<CameraRecord>({});
  allCamerasRef.current = allCameras;
  const allVideosRef = useRef<VideoRecord>({});
  allVideosRef.current = allVideos;

  // stores the current selected objects
  const [selectedAoiId, setSelectedAoiId] = useState<number | null>(null);
  const [selectedSubareaId, setSelectedSubareaId] = useState<number | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState<number | null> (null)
  const selectedAoiRef = useRef<number | null>(null);
  selectedAoiRef.current = selectedAoiId
  const selectedSubareaRef = useRef<number | null>(null);
  selectedSubareaRef.current = selectedSubareaId
  const selectedCameraRef = useRef<number | null>(null);
  selectedCameraRef.current = selectedCameraId

  // stores the objects currently highlighted by the mao
  const [highlightedAoiId, setHighlightedAoiId] = useState<number | null>(null);
  const [highlightedSubareaId, setHighlightedSubareaId] = useState<number | null>(null);
  const [highlightedCameraId, setHighlightedCameraId] = useState<number | null>(null);

  // the current active "selection mode" (all aoi/home, aoi, subarea, camera)
  const currentSelectionModeRef = useRef<"all" | SummaryType >("all")
  currentSelectionModeRef.current = selectedCameraRef.current ? "camera" : selectedSubareaRef.current ? "subarea" : selectedAoiRef.current ? "area" : "all"

  // are we currently in an edit mode?
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawType, setDrawType] = useState<null | SummaryType | "polygon">(null);
  const [drawSubareaType, setDrawSubareaType] = useState<null | SubAreaType>(null);
  const [drawParentId, setDrawParentId] = useState<null | number>(null);
  const [drawIsLoading, setDrawIsLoading] = useState<boolean>(false);
  
  const isDrawingRef = useRef<boolean>(false);
  isDrawingRef.current = isDrawing;
  const drawTypeRef = useRef<null | SummaryType | "polygon">(null);
  drawTypeRef.current = drawType;
  const drawSubareaTypeRef = useRef<SubAreaType>(null);
  drawSubareaTypeRef.current = drawSubareaType;
  const drawParentIdRef = useRef<null | number>(null);
  drawParentIdRef.current = drawParentId;
  const drawIsLoadingRef = useRef<boolean>(false);
  drawIsLoadingRef.current = drawIsLoading;

  // when updated, zoom to this location
  const [mapGoTo, setMapGoTo] = useState<[number, number] | null>(null)
  const mapGoToRef = useRef<[number, number] | null>(null);
  mapGoToRef.current = mapGoTo;

  // handles states for editing and deletingareas/subareas/cameras
  const [editAction, setEditAction] = useState<null | "rename" | "delete" | "recalibrate">(null);
  const [editObjectType, setEditObjectType] = useState<null | SummaryType>(null);
  const [editId, setEditId] = useState<null | number>(null);
  const [editName, setEditName] = useState("");
  const [editIsLoading, setEditIsLoading] = useState<boolean>(false);

  // legacy states — move above when currently being used
  const pendingSubAreaTypeRef = useRef<SubAreaType | null>(null);
  const [aoiItems, setAoiItems] = useState<AoiItem[]>([]);
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);
  const [hoveredSubAreaId, setHoveredSubAreaId] = useState<number | null>(null);
  const selectedAoiIdRef = useRef<number | null>(null);
  selectedAoiIdRef.current = selectedAoiId;
  const aoiItemsRef = useRef(aoiItems);
  aoiItemsRef.current = aoiItems;
  const [aoiBounds, setAoiBounds] = useState<[[number, number], [number, number]] | null>(null);
  const [subAreaItems, setSubAreaItems] = useState<AoiItem[]>([]);
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
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AOI delete confirmation state
  const [deleteConfirmAoi, setDeleteConfirmAoi] = useState<AoiItem | null>(null);

  // Sub-area edit-dialog state
  // const [editName, setEditName] = useState("");
  const [deletingSubarea, setDeletingSubarea] = useState(false);
  const [savingSubarea, setSavingSubarea] = useState(false);

  // Sub-area delete confirmation state
  const [deleteConfirmSubArea, setDeleteConfirmSubArea] = useState<number | null>(null);

  // Camera edit-dialog state
  const [editCamera, setEditCamera] = useState<AoiItem | null>(null);
  const [editCameraName, setEditCameraName] = useState("");
  const [savingCamera, setSavingCamera] = useState(false);
  const [deletingCamera, setDeletingCamera] = useState(false);

  // Camera delete confirmation state
  const [deleteConfirmCamera, setDeleteConfirmCamera] = useState<AoiItem | null>(null);

  // Direct updater for SideMenu sub-area list
  const sideMenuUpdaterRef = useRef<SideMenuUpdater | null>(null);

  // Loading state
  const [isMapLoading, setIsMapLoading] = useState(true);

  // Feed tab active state
  const [isFeedTabActive, setIsFeedTabActive] = useState(false);

  // function to force update the side menu and map from anywhere
  const [currentRefreshTrigger, setCurrentRefreshTrigger] = useState<boolean>(false);
  const forceTriggerRefresh = () => { setCurrentRefreshTrigger(!setCurrentRefreshTrigger); }





  // Initial fetch
  useEffect(() => {
    let cancelled = false;
    
    Promise.all([
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=aoi`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=sub_area`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/`).then((r) => r.json())
    ]).then(([aoiData, subareaData, cameraData, videoData]) => {
      
      // quickfail
      if (!aoiData.success || !subareaData.success || !cameraData.success || !videoData.success) { return; }

      aoiData = aoiData.saved_locations;
      subareaData = subareaData.saved_locations;
      cameraData = cameraData.cameras;
      videoData = videoData.videos;

      // using videos, cameras, and subareas: create a list of children by parent
      const videoIdsByCamera: Record<number, number[]> = {}
      const cameraIdsBySubarea: Record<number, number[]> = {}
      const subareaIdsByArea: Record<number, number[]> = {}

      // and empty objects for our main objects
      const videosProcessed: VideoRecord = {}
      const camerasProcessed: CameraRecord = {}
      const subareasProcessed: SubareaRecord = {}
      const aoisProcessed: AOIRecord = {}

      // step 1: format videos
      for (const curr of videoData) {
        const parentOfThis = curr.camera ?? -1;
        parentOfThis in videoIdsByCamera ? videoIdsByCamera[parentOfThis].push(curr.id) : videoIdsByCamera[parentOfThis] = [curr.id]
        if (parentOfThis === -1) { continue }
        videosProcessed[curr.id] = convertObjectToVideoSummary(curr);
      }
      
      // step 2: format cameras
      for (const curr of cameraData) {
        const parentOfThis = curr.saved_location ?? -1;
        parentOfThis in cameraIdsBySubarea ? cameraIdsBySubarea[parentOfThis].push(curr.id) : cameraIdsBySubarea[parentOfThis] = [curr.id]
        if (parentOfThis === -1) { continue }

        camerasProcessed[curr.id] = convertObjectToCameraSummary(curr, {
          video_count: (videoIdsByCamera[curr.id] ?? []).length,
          video_ids: (videoIdsByCamera[curr.id] ?? []),
        })
      }
      
      // step 3: format subareas
      for (const curr of subareaData) {
        const parentOfThis = curr.parent_id ?? -1;
        parentOfThis in subareaIdsByArea ? subareaIdsByArea[parentOfThis].push(curr.id) : subareaIdsByArea[parentOfThis] = [curr.id]
        if (parentOfThis === -1) { continue }

        subareasProcessed[curr.id] = convertObjectToSubareaSummary(curr, {
          vehicle_breakdown: (curr.vehicle_breakdown ?? {}) as Record<string, number>,
          camera_count: (cameraIdsBySubarea[curr.id] ?? []).length,
          camera_ids: (cameraIdsBySubarea[curr.id] ?? []),
        })
      }

      // step 4: format areas
      for (const curr of aoiData) {
        // get subarea and all stats that can be obtained via them
        const childSubareasIds = subareaIdsByArea[curr.id] ?? []
        const childSubareas = childSubareasIds.map((id) => subareasProcessed[id] ?? null ).filter((x) => x != null)
        const stats = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0, "vehicles": 0, "adb": 0, "speeding": 0, "swerving": 0, "abrupt_stopping": 0}
        for (const curr of childSubareas) {
          for (const vehicle in stats) {
            stats[vehicle] += curr.vehicle_breakdown[vehicle] ?? 0;
          }
          stats.vehicles += curr.vehicles ?? 0;
          stats.adb += curr.adb ?? 0;
          stats.speeding += curr.speeding ?? 0;
          stats.swerving += curr.swerving ?? 0;
          stats.abrupt_stopping += curr.abrupt_stopping ?? 0;
        }

        aoisProcessed[curr.id] = convertObjectToAreaSummary(curr, {
          subarea_count: childSubareasIds.length ?? 0,
          subarea_ids: childSubareasIds,

          vehicles: stats.vehicles,
          adb: stats.adb,
          speeding: stats.speeding,
          swerving: stats.swerving,
          abrupt_stopping: stats.abrupt_stopping,
          vehicle_breakdown: stats
        })
      }

      // with those done, set these to our new variables
      setAllAois(aoisProcessed);
      setAllSubareas(subareasProcessed);
      setAllCameras(camerasProcessed);
      setAllVideos(videosProcessed);

    }).catch(() => {
      // error handling
      
    }).finally(() => {
      if (!cancelled) setIsMapLoading(false);
    })
    return () => { cancelled = true; };
  }, []);





  // Auto-clear draw error after 4 seconds
  useEffect(() => {
    const ERROR_LENGTH_SECONDS = 4
    if (!drawError) return;
    const t = setTimeout(() => setDrawError(null), ERROR_LENGTH_SECONDS*1000);
    return () => clearTimeout(t);
  }, [drawError]);

  // TODO — NOT YET REWORKED
  const handleCameraEnter = useCallback((camera: CameraSummary) => {
    setAtCameraDetailLevel(true);
    setSelectedCameraMapId(camera.id);
    setIsPlacingCamera(false);
  }, []);

  // TODO — NOT YET REWORKED
  const handleAddCamera = useCallback(() => setIsPlacingCamera((d) => !d), []);

  // TODO — NOT YET REWORKED
  const handleCameraAdded = useCallback((_id: number, _lat: number, _lng: number, camera: Record<string, any>) => {
    setIsPlacingCamera(false);
    setSubareaCameraIds((prev) => [...(prev ?? []), _id]);
    if (selectedSubareaIdRef.current != null) {
      //sideMenuUpdaterRef.current?.addCamera(
      //  convertObjectToCameraSummary(camera),
      //  selectedSubareaIdRef.current,
      // );
    }
  }, []);
  // TODO — NOT YET REWORKED
  const handleCameraPlacedOutside = useCallback(() => {
    setDrawError("Camera must be placed within the sub-area boundaries.");
  }, []);

  // TODO — NOT YET REWORKED
  const handleDeleteConfirm = async () => {
    if (!deleteConfirmAoi) return;
    const target = deleteConfirmAoi;

    setAoiItems((prev) => prev.filter((a) => a.id !== target.id));
    setDeleteConfirmAoi(null);
    setHighlightedAoiId(null);

    setDeleting(true);
    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${target.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      //updateSideMenu()
    } catch (err) {
      console.error("Failed to delete AOI:", err);
      setAoiItems((prev) => [...prev, { id: target.id, name: target.name, ring: target.ring }]); // revert
    } finally {
      setDeleting(false);
    }
  };

  

  
  // checks if this object is present in the [Object]Record map 
  function idIsPresentInMap(type: SummaryType, id: number) {
    switch (type) {
      case "area":
        return id in allAoisRef.current

      case "subarea":
        return id in allSubareasRef.current

      case "camera":
        return id in allCamerasRef.current
    }
  }

  // gets object from map (if present)
  function getSummaryFromId(type: SummaryType, id: number): null | AOISummary | SubAreaSummary | CameraSummary {
    if (!idIsPresentInMap(type, id)) return null;
    switch(type) {
      case "area":
        return allAoisRef.current[id]

      case "subarea":
        return allSubareasRef.current[id]

      case "camera":
        return allCamerasRef.current[id]
    }
  }

  // converts a compatible Summary object to a relevant map format
  const convertToMapAreaFormat = (obj: AOISummary | SubAreaSummary) => {
    return {
        id: obj.id,
        name: obj.name,
        ring: obj.geometry
      } as AoiItem
  }

  const convertToCameraAreaFormat = (obj: CameraSummary) => {
      return {
        id: obj.id,
        name: obj.name,
        lat: obj.lat,
        lng: obj.lng,
        polygon: obj.polygon ?? undefined,
        occurrences: undefined,
      }
  }






  // aliases of getObjectFromMap that specifies the necessary type
  function getAoiSummaryFromId(id: number): null | AOISummary { return getSummaryFromId("area", id) as (AOISummary | null) }
  function getSubareaSummaryFromId(id: number): null | SubAreaSummary { return getSummaryFromId("subarea", id) as (SubAreaSummary | null) }
  function getCameraSummaryFromId(id: number): null | CameraSummary { return getSummaryFromId("camera", id) as (CameraSummary | null) }

  // handles selecting a certain object
  const handleNavigateTo = useCallback((type: SummaryType, id: number) => {
    let thisObject: AOISummary | SubAreaSummary | CameraSummary;

    switch(type) {
      case "area":
        if (!(id in allAoisRef.current)) { return; }
        setSelectedAoiId(id);
        setHighlightedAoiId(null); // deactivate map highlights
        thisObject = allAoisRef.current[id]
        setMapGoTo([thisObject.lng, thisObject.lat])
        break;
      case "subarea":
        if (!(id in allSubareasRef.current && selectedAoiRef.current != null && (allAoisRef.current[selectedAoiRef.current].subarea_ids)?.includes(id))) { return; }
        setSelectedSubareaId(id);
        setHighlightedSubareaId(null); // deactivate map highlights
        thisObject = allSubareasRef.current[id]
        setMapGoTo([thisObject.lng, thisObject.lat])
        break;
      case "camera":
        if (!(id in allCamerasRef.current && selectedSubareaRef.current != null && (allSubareasRef.current[selectedSubareaRef.current].camera_ids)?.includes(id))) { return; }
        setSelectedCameraId(id);
        setHighlightedCameraId(null); // deactivate map highlights
        thisObject = allCamerasRef.current[id]
        setMapGoTo([thisObject.lng, thisObject.lat])
        break;
    }
  }, [])

  // handles map selections (highlight in map)
  const handleMapSelection = useCallback((type: SummaryType, id: number | null) => {
    if (isDrawingRef.current) return; // do not accept map selections when drawing something

    switch(type) {
      case "area": 
        if (selectedAoiRef.current != null) return; // in AOI view this AOI is displayed as context only — ignore clicks
        if (selectedAoiRef.current !== id) {
          // highlight this area
          const thisObject = getAoiSummaryFromId(id);
          setHighlightedAoiId(id);
          setMapGoTo([thisObject.lng, thisObject.lat])
        } else {
          // select this area
          handleNavigateTo(type, id)
        }
        break;

      case "subarea":
        if (selectedSubareaRef.current != null) return; // in subarea view this subarea is displayed as context only — ignore clicks
        if (selectedAoiRef.current !== id) {
          // highlight this area
          const thisObject = getSubareaSummaryFromId(id);
          setHighlightedSubareaId(id);
          setMapGoTo([thisObject.lng, thisObject.lat])
        } else {
          // select this area
          handleNavigateTo(type, id)
        }
        break;
      
      case "camera":
        // select if not yet selected, deselect if so
        if ((selectedCameraRef.current ?? null) === id ) {
          handleBack();
        } else {
          handleNavigateTo(type, id);
        }
        break;
    }
  }, [])

  // returns from the previous menu
  const handleBack = useCallback(() => {
    // force shut isDrawing flags
    handleDrawingCleanup()

    // deselect anything highlighted by the map
    setHighlightedAoiId(null);
    setHighlightedSubareaId(null);
    setHighlightedCameraId(null);


    if (selectedCameraRef.current != null) {
      // back from CAMERA
      setSelectedCameraId(null);

    } else if (selectedSubareaRef.current != null) {
      // back from SUBAREA
      setSelectedSubareaId(null);
      setSubareaBounds(null);
      setHighlightedSubareaId(null);
      setSubAreaItems([]);
      
      setAtCameraLevel(false);
      setAtCameraDetailLevel(false);
      setSelectedCameraMapId(null);
      setSubareaCameraIds(null);
      setSubareaBounds(null);
      setAoiBounds((prev) => prev ? [[prev[0][0], prev[0][1]], [prev[1][0], prev[1][1]]] : null);

    } else if (selectedAoiRef.current != null) {
      // back from AREA
      setSelectedAoiId(null);
      setAoiBounds(null);
    }
  }, [])

  // handles toggling (on or off) a given drawing new area/subarea/camera switch
  const handleOnDrawingToggle = (type: SummaryType, subareaType?: null | SubAreaType, parentId: number | null = null) => {
    
    if (type === "subarea" && subareaType == null) return;  // silently quickfail this error
    if (type !== "area" && parentId == null) return;        // also on this case

    // if subarea: also do checks for subarea type
    if (type === "subarea") {
      if (subareaType === drawSubareaType) { handleDrawingCleanup() }
      else { setIsDrawing(true); setDrawType("subarea"); setDrawSubareaType(subareaType); }
    }

    // if not: toggle on only if current type is /not/ the same
    else {
      if (type === drawType) { handleDrawingCleanup() }
      else { setIsDrawing(true); setDrawType(type); setDrawSubareaType(null); }
    }

    setDrawParentId(type === "area" ? null : parentId);
  }

  // cleans up drawing-related variables
  const handleDrawingCleanup = () => {
    setIsDrawing(false);
    setDrawType(null);
    setDrawSubareaType(null);
    setDrawParentId(null);
    setDrawIsLoading(false)
  }

  // handles edit menu being closed, performs cleanup for all the related variables
  const handleEditClose = () => {
    setEditAction(null);
    setEditId(null);
    setEditIsLoading(false);
    setEditObjectType(null)
    setEditName("");
  };

  const handleStartEditingName = (type: SummaryType, id: number) => {
    if (!idIsPresentInMap(type, id)) return; // quickfail

    // get name; name has to be initialized before and stay initialized while editAction is not null
    const thisObject = getSummaryFromId(type, id);
    setEditName(thisObject.name);

    // set all relevant states
    setEditAction("rename")
    setEditId(id);
    setEditObjectType(type);
  }

  const handleStartDeletion = (type: SummaryType, id: number) => {
    if (!idIsPresentInMap(type, id)) return; // quickfail

    // get name; name has to be initialized before and stay initialized while editAction is not null
    const thisObject = getSummaryFromId(type, id);
    setEditName(thisObject.name);

    // set all relevant states
    setEditAction("delete")
    setEditId(id);
    setEditObjectType(type);
  }

  

  // called once user finished drawing an AOI or subarea on the map
  const handleAoiDrawn = useCallback(async (ring: [number, number][], clearDrawing: () => void) => {

    // clean up edit menu and polygon in map
    handleDrawingCleanup()
    clearDrawing();

    // retrieve consts based on our states set earlier
    const type = drawTypeRef.current;
    const parentId = drawParentIdRef.current;
    const subareaType = drawSubareaTypeRef.current;

    // quickfail conditions
    if (!isDrawingRef.current) return;
    if (type === "subarea" && (subareaType == null || parentId == null || !idIsPresentInMap("area", parentId))) return;
    
    // set loading state
    setDrawIsLoading(true)

    // get our parent as a const
    const parent = (type === "subarea") ? getAoiSummaryFromId(parentId) : null; 
    
    // set consts based on our bounding box geometry
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
    
    // another fail condition — throw an error if not within bounds of subarea
    if (type === "subarea") {
        // Validate that the drawn polygon is within the AOI's bounding box
        const aoiLngs = parent.geometry.map((p) => p[0]);
        const aoiLats = parent.geometry.map((p) => p[1]);
        const aoiMinLng = Math.min(...aoiLngs), aoiMaxLng = Math.max(...aoiLngs);
        const aoiMinLat = Math.min(...aoiLats), aoiMaxLat = Math.max(...aoiLats);
        const [subMinLng, subMinLat] = bounds[0] as [number, number];
        const [subMaxLng, subMaxLat] = bounds[1] as [number, number];

        if (subMinLng < aoiMinLng || subMinLat < aoiMinLat || subMaxLng > aoiMaxLng || subMaxLat > aoiMaxLat) {
          setDrawError("Polygon must be within the AOI boundaries.");
          setDrawIsLoading(false);
          return;
        }
    }

    // default name
    const defaultName = "New " + (type === "area" ? "area" : subareaType.toLowerCase().replaceAll("_", " "));

    try {
      let newObjectRaw;
      if (type === "area") {
        newObjectRaw = {
            name: defaultName,
            lat: centroid.lat,
            lng: centroid.lng,
            geometry: ring,
            bounds,
            location_type: "aoi",
            parent_id: null,
          }
        } else if (type === "subarea") {
          newObjectRaw = {
            name: defaultName,
            lat: centroid.lat,
            lng: centroid.lng,
            geometry: ring,
            bounds,
            location_type: "sub_area",
            sub_area_type: subareaType,
            parent_id: parentId,
          }
        }
        
        // ----- shared portion — pass our request to the api
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newObjectRaw),
        });
        if (!res.ok) throw new Error(await res.text());

        // unpack data sent by our api
        const saved = await res.json();
        const newId = saved.saved_location?.id
        if (newId == undefined) { throw new Error("Unable to get id of new object") }
        // ----- shared portion ends here

        if (type === "area") {
          // add to list of areas
          const newArea = convertObjectToAreaSummary(saved.saved_location ?? {...newObjectRaw, id: newId});
          const newAreaList = allAoisRef.current
          newAreaList[newId] = newArea
          setAllAois(newAreaList)

          forceTriggerRefresh();
          console.log("new entity set <3")
        } else if (type === "subarea") {
          // add to list of subareas
          const newSubarea = convertObjectToSubareaSummary(saved.saved_location ?? {...newObjectRaw, id: newId});
          const newSubareaList = allSubareasRef.current
          newSubareaList[newId] = newSubarea;
          setAllSubareas(newSubareaList)

          // update the parent area
          parent.subarea_count += 1;
          parent.subarea_ids = [...parent.subarea_ids, newId];
          const newAreaList = allAoisRef.current;
          newAreaList[parentId] = parent;
          setAllAois(newAreaList)
          
          forceTriggerRefresh();
          setDrawIsLoading(false);
          console.log("new entity set <3")
        }

    } catch (exception) {
      console.log(exception)
    } finally {
      // and done! do cleanup
      handleDrawingCleanup()
    }
  }, []);

  // asks the API to rename the given object;
  const handleRenameObject = async () => {
    if (editAction !== "rename") return; // quickfail
    
    const newName = editName;
    const id = editId;
    const type = editObjectType;

    if (!idIsPresentInMap(type, id)) return; // quickfail
    
    setEditIsLoading(true);
    try {

      if (type != "camera") { // area or subarea
          const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          });
          if (!res.ok) { console.log(await res.text()); return false; }

          // past this point, api success - patch the relevant data in our local copy
          if (type === "area") {
            const newAllAois = allAois;
            newAllAois[id].name = newName;
            setAllAois(newAllAois)
            return;
          } else if (type === "subarea"){ // subarea
            const newAllSubareas = allSubareas;
            newAllSubareas[id].name = newName;
            setAllSubareas(newAllSubareas)
          }

      } else if (type == "camera") { // camera
      }

    } catch {
    } finally {
      // cleanup
      handleEditClose()
      }
  }

  // asks the API to delete the given object
  const handleDeleteObject = async () =>  {
    if (editAction !== "delete") return; // quickfail
    
    const id = editId;
    const type = editObjectType;

    if (!idIsPresentInMap(type, id)) return; // quickfail
    
    setEditIsLoading(true);
    
    // if id is currently selected, back out of it

    
    try {
      if (type !== "camera") { // deleting area or subarea
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${id}/`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(await res.text()); // throw error and shunt out

        // done — in this case, delete in our local area/subarea list
        if (type === "area") {
          if (selectedAoiRef.current === id) handleBack(); // perform a return if this is selected
          const newAllAois = allAoisRef.current;
          delete newAllAois[id];
          setAllAois(newAllAois);
        } else if (type === "subarea") {
          if (selectedSubareaRef.current === id) handleBack(); // perform a return if this is selected
          const newAllSubareas = allSubareasRef.current;
          const parentOfThis = newAllSubareas[id].parent
          delete newAllSubareas[id];
          setAllSubareas(newAllSubareas);

          const newAllAreas = allAoisRef.current;
          newAllAreas[parentOfThis].subarea_count--;
          newAllAreas[parentOfThis].subarea_ids = newAllAreas[parentOfThis].subarea_ids.filter((x) => x !== id)
          setAllAois(newAllAreas)          
        }
      } else if (type === "camera") { // deleting camera
        if (selectedCameraRef.current === id) handleBack() // perform a return if this is selected
      }
    } catch (exception) {
      console.log(exception)
    } finally {
      // cleanup
      handleEditClose()
      setEditIsLoading(false)
      forceTriggerRefresh();
    }
  }

  // returns a list of all areas in this format
  const getAllAreasAsArray = () => {
    return convertRecordToArray(allAoisRef.current).map((aoi) => convertToMapAreaFormat(aoi))
  }
  // gets all children of this parent object, as an array of LocationSummary objects
  const getAllSubareaChildrenAsArray = (parentId: number) => {
    return convertRecordToArray(allSubareasRef.current).filter((x) => x.parent === parentId).map((sub) => convertToMapAreaFormat(sub))
  }
  // gets all children of this parent object, as an array of LocationSummary objects
  const getAllCameraChildrenAsArray = (parentId: number) => {
    return convertRecordToArray(allCamerasRef.current).filter((x) => x.parent === parentId).map((cam) => convertToCameraAreaFormat(cam));
  }

  return (
    <Box sx={{ width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Full-screen map */}
      {/* aoiItems={selectedSubareaId != null ? ([] as AoiItem[]) : selectedAoiId != null ? aoiItems.filter((a) => a.id === selectedAoiId) : aoiItems} */}
      <Box sx={{ position: "fixed", top: 0, right: 0, bottom: 0, left: 0 }}>
        <Map
          mode="map"
          aoiItems = {
            currentSelectionModeRef.current === "all" ? 
            getAllAreasAsArray() :
            currentSelectionModeRef.current === "area" ?
            [convertToMapAreaFormat(allAoisRef.current[selectedAoiRef.current])] :
            []
          }

          subAreaItems={
            currentSelectionModeRef.current === "all" ?
            [] :
            currentSelectionModeRef.current === "area" ?
            getAllSubareaChildrenAsArray(selectedAoiRef.current) :
            currentSelectionModeRef.current === "subarea" ?
            [convertToMapAreaFormat(allSubareasRef.current[selectedSubareaRef.current])] :
            []
          }

          cameraItems = {
            
            //currentSelectionModeRef.current === "subarea" ?
            //getAllCameraChildrenAsArray(selectedSubareaRef.current) :
            //currentSelectionModeRef.current === "camera" ?
            //[convertToCameraAreaFormat(allCamerasRef.current[selectedCameraRef.current])] :
            //[]
            convertRecordToArray(allCamerasRef.current).map((x) => convertToCameraAreaFormat(x))
          }
          visibleCameraIds={
            currentSelectionModeRef.current === "subarea" ?
            allSubareasRef.current[selectedSubareaRef.current].camera_ids ?? [] :
            currentSelectionModeRef.current === "camera" ?
            [ selectedCameraRef.current ] :
            []
          }

          refreshTrigger={currentRefreshTrigger}
          currentSelectionMode={currentSelectionModeRef.current}
          selectedCameraId={selectedCameraRef.current}
          goTo={mapGoTo}
          
          onObjectClick={handleMapSelection}
          onRequestRename={handleStartEditingName}
          onRequestDelete={handleStartDeletion}     
          
          isDrawingAOI={isDrawing}  
          onAoiDrawn={handleAoiDrawn}   

          hideEditControls={!isFeedTabActive}
          cleanMap={selectedSubareaId == null}
          showGeocoder
          hoveredAoiId={hoveredAoiId}
          activeAoiId={highlightedAoiId}
          onAoiEdit={() => {}}
          onAoiDelete={() => {}}
          
          hideAoiMarkers={selectedAoiId != null}
          hideSubAreaMarkers={atCameraLevel}
          disableSubAreaInteraction={atCameraLevel}
          hoveredSubAreaId={hoveredSubAreaId}
          activeSubAreaId={highlightedSubareaId}
          onSubAreaEdit={() => {}}
          onSubAreaDelete={() => {}}
          onSubAreaHover={(id) => setHoveredSubAreaId(id)}
          isPlacingCamera={isPlacingCamera}
          cameraParentLocationId={selectedSubareaId}
          hideCameraPolygons={false}
          onCameraAdd={handleCameraAdded}
          onCameraPlacedOutside={handleCameraPlacedOutside}
        />
      </Box>

      {/* SideMenu */}
      <Box sx={{ position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <SideMenu
          refreshTrigger={currentRefreshTrigger}
          onMount={(updater) => { sideMenuUpdaterRef.current = updater; }}

          allAois = {allAoisRef.current}
          allSubareas = {allSubareasRef.current}
          allCameras = {allCamerasRef.current}
          allVideos = {allVideosRef.current}
          
          selectedAOI={selectedAoiRef.current ? allAoisRef.current[selectedAoiRef.current] : null}
          selectedSubarea={selectedSubareaRef.current ? allSubareasRef.current[selectedSubareaRef.current] : null}
          selectedCamera={selectedCameraRef.current ? allCamerasRef.current[selectedCameraRef.current] : null}
          currentSelectionMode={currentSelectionModeRef.current}

          onCameraEnter={handleCameraEnter}
          onAddCamera={handleAddCamera}

          onNavigateTo={handleNavigateTo}
          onBack={handleBack}
          onCardClick={handleMapSelection}
          canStartDrawing={!drawIsLoadingRef.current}
          onStartDrawing={handleOnDrawingToggle}
          onRequestRename={handleStartEditingName}
          onRequestDelete={handleStartDeletion}

          isDrawingAOI={isDrawingRef.current && drawTypeRef.current === "area"}
          isDrawingSubarea={(isDrawingRef.current && drawTypeRef.current === "subarea") ? drawSubareaTypeRef.current : false}
          isDrawingCamera={isDrawingRef.current && drawTypeRef.current === "camera"}

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
        open={ editAction === "rename" }
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
            onKeyDown={(e) => { if (e.key === "Enter") handleRenameObject(); }}
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
            onClick={() => {handleRenameObject()}}
            disabled={ editIsLoading }
            variant="contained"
            sx={{ bgcolor: "#1d1f3f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#11153f" } }}
          >
            {editIsLoading ? <CircularProgress size={16} sx={{ color: "#fff" }} />  : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* AOI delete confirmation dialog */}
      <Dialog
        open={ editAction === "delete" }
        onClose={handleEditClose}
        PaperProps={{ sx: { borderRadius: "14px", minWidth: 300, p: 0.5 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", pr: 1 }}>
          <Typography fontWeight={700} sx={{ flex: 1, color: "#1d1f3f" }}>Delete Area</Typography>
          <IconButton size="small" onClick={handleEditClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: "8px !important" }}>
          <Typography sx={{ color: "#444" }}>
            Delete the {editObjectType} &ldquo;{editName}&rdquo;? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, justifyContent: "flex-end" }}>
          <Button onClick={handleEditClose} sx={{ textTransform: "none", color: "#555" }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteObject}
            disabled={ editIsLoading }
            variant="contained"
            sx={{ bgcolor: "#d32f2f", borderRadius: "8px", textTransform: "none", "&:hover": { bgcolor: "#b71c1c" } }}
          >
            {editIsLoading ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>



    </Box>
  );
}