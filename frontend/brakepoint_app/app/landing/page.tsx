"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, CircularProgress, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SideMenu from "@/components/landing/sideMenu";
// import type { SideMenuUpdater } from "@/components/landing/sideMenu";
import { authFetch } from "@/lib/authFetch";

import { CameraAddModal, CameraEditModal } from "@/components/landing/cameraModals";
import { useNotifications } from "@/contexts/NotificationContext";
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
import { ValidateNotSelfIntersecting } from "terra-draw";
import { dataIndexSerializer } from "@mui/x-charts/internals";

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

  // have we finished loading our videos?
  const [locationSummariesReady, setLocationSummariesReady] = useState<boolean>(false);
  const locationSummariesReadyRef = useRef<boolean>(false);
  locationSummariesReadyRef.current = locationSummariesReady;
  const [videosReady, setVideosReady] = useState<boolean>(false);
  const videosReadyRef = useRef<boolean>(false);
  videosReadyRef.current = videosReady;
  

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
  const [drawType, setDrawType] = useState<null | SummaryType>(null);
  const [drawSubareaType, setDrawSubareaType] = useState<null | SubAreaType>(null);
  const [drawParentId, setDrawParentId] = useState<null | number>(null);
  const [drawIsLoading, setDrawIsLoading] = useState<boolean>(false);
  
  const isDrawingRef = useRef<boolean>(false);
  isDrawingRef.current = isDrawing;
  const drawTypeRef = useRef<null | SummaryType>(null);
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
  const [editAction, setEditAction] = useState<null | "rename" | "delete" | "recalibrate" | "addVideo" | "editVideo">(null);
  const [editObjectType, setEditObjectType] = useState<null | SummaryType | "video">(null);
  const [editId, setEditId] = useState<null | number>(null);
  const [editName, setEditName] = useState("");
  const [editIsLoading, setEditIsLoading] = useState<boolean>(false);

  // legacy states — move above when currently being used
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);
  const [hoveredSubAreaId, setHoveredSubAreaId] = useState<number | null>(null);
  const selectedAoiIdRef = useRef<number | null>(null);
  selectedAoiIdRef.current = selectedAoiId;
  const selectedSubareaIdRef = useRef<number | null>(null);
  selectedSubareaIdRef.current = selectedSubareaId;
  const [atCameraLevel, setAtCameraLevel] = useState(false);
  const [isPlacingCamera, setIsPlacingCamera] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  // Edit-dialog state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Direct updater for SideMenu sub-area list
  // const sideMenuUpdaterRef = useRef<SideMenuUpdater | null>(null);

  // Feed tab active state
  const [isFeedTabActive, setIsFeedTabActive] = useState(false);

  // function to force update the side menu and map from anywhere
  const [currentRefreshTrigger, setCurrentRefreshTrigger] = useState<boolean>(false);
  const forceTriggerRefresh = () => { setCurrentRefreshTrigger(!setCurrentRefreshTrigger); }

  // prepare to bake some nice warm toast (enables the use of toasts)
  const { trackVideoProcessing, showToast } = useNotifications();






  // runs the below function on startup
  useEffect(() => {
      initialLoadLocationSummaries();
  }, [])

  // Initial fetch
  const initialLoadLocationSummaries = async () => {
    let cancelled = false;

    Promise.all([
        // authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=aoi`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=sub_area`).then((r) => r.json()),
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`).then((r) => r.json()),
    ]).then(([aoiData, subareaData, cameraData]) => {
      
      // quickfail
      if (!aoiData.success || !subareaData.success || !cameraData.success) { return; }

      aoiData = aoiData.saved_locations;
      subareaData = subareaData.saved_locations;
      cameraData = cameraData.cameras;

      // for some reason, doing these four fetches separately is somehow faster??? commented out attempt to fetch all areas and subareas at once
      // savedLocationData = savedLocationData.saved_locations;
      // const aoiData = savedLocationData.filter((loc) => loc.location_type === "aoi")
      // const subareaData = savedLocationData.filter((loc) => loc.location_type === "sub_area")

      // using cameras, and subareas: create a list of children by parent
      const cameraIdsBySubarea: Record<number, number[]> = {}
      const subareaIdsByArea: Record<number, number[]> = {}

      // and empty objects for our main objects
      // const videosProcessed: VideoRecord = {}
      const camerasProcessed: CameraRecord = {}
      const subareasProcessed: SubareaRecord = {}
      const aoisProcessed: AOIRecord = {}

      // step 1: format cameras
      for (const curr of cameraData) {
        const parentOfThis = curr.saved_location ?? -1;
        parentOfThis in cameraIdsBySubarea ? cameraIdsBySubarea[parentOfThis].push(curr.id) : cameraIdsBySubarea[parentOfThis] = [curr.id]
        if (parentOfThis === -1) { continue }

        camerasProcessed[curr.id] = convertObjectToCameraSummary(curr)
      }
      
      // step 2: format subareas
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

      // step 3: format areas
      for (const curr of aoiData) {
        // get subarea and all stats that can be obtained via them
        const childSubareasIds = subareaIdsByArea[curr.id] ?? []
        const childSubareas = childSubareasIds.map((id) => subareasProcessed[id] ?? null ).filter((x) => x != null)
        const stats = {"vehicles": 0, "adb": 0, "speeding": 0, "swerving": 0, "abrupt_stopping": 0}
        const vehicle_breakdown = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0}
        for (const curr of childSubareas) {
          for (const vehicle in vehicle_breakdown) {
            vehicle_breakdown[vehicle] += curr.vehicle_breakdown[vehicle] ?? 0;
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
          vehicle_breakdown: vehicle_breakdown
        })
      }

      // with those done, set these to our new variables
      setAllAois(aoisProcessed);
      setAllSubareas(subareasProcessed);
      setAllCameras(camerasProcessed);

      // continue to loading videos
      initialLoadVideos();

    }).catch(() => {
      // error handling
      
    }).finally(() => {
      if (!cancelled) {
        setLocationSummariesReady(true);
      }
    })
    return () => { cancelled = true; };
  };

  // initial fetch for all videos, loads /after/ location summaries have been loaded
  const initialLoadVideos = async () => {

    setVideosReady(false);
    try { 
      authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/`).then((r) => r.json())
      .then((videoData) => {
        if (!videoData.success) { return; }

        // variable temp storages
        const videoIdsByCamera: Record<number, number[]> = {}
        const videosProcessed: VideoRecord = {};

        // process videos
        for (const curr of videoData.videos) {
          const parentOfThis = curr.camera ?? -1;
          parentOfThis in videoIdsByCamera ? videoIdsByCamera[parentOfThis].push(curr.id) : videoIdsByCamera[parentOfThis] = [curr.id]
          if (parentOfThis === -1 || !idIsPresentInMap("camera", parentOfThis)) { continue } // quickfail; this is corrupted data and should be ignored
          videosProcessed[curr.id] = convertObjectToVideoSummary(curr);
        }

        // for all cameras with videos, edit them to include relevant statistics
        const newCamerasList = allCamerasRef.current;
        for (const cameraId of Object.keys(videoIdsByCamera)) {
          const camera = getCameraSummaryFromId(Number(cameraId));
          if (camera === null) continue;
          const childrenVideoIds = videoIdsByCamera[cameraId];
          const childrenVideos = Object.values(videosProcessed).filter((x) => childrenVideoIds.includes(x.id));

          camera.video_count = childrenVideoIds.length;
          camera.video_ids = childrenVideoIds;

          // reset stats and reload to be very sure they are accurate here
          camera.latest_upload = null;
          camera.vehicles = 0; camera.adb = 0;
          camera.speeding = 0; camera.swerving = 0; camera.abrupt_stopping = 0;
          const newVehicleBreakdown = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0} as VehicleBreakdown

          for (const currVideo of childrenVideos) {
            camera.vehicles += currVideo.vehicles;
            camera.adb += currVideo.occurrences;
            camera.speeding += currVideo.speeding_count;
            camera.swerving += currVideo.swerving_count;
            camera.abrupt_stopping += currVideo.abrupt_stopping_count;
            
            if (camera.latest_upload === null || camera.latest_upload < currVideo.uploaded_at) {
              camera.latest_upload = currVideo.uploaded_at;
              camera.latest_upload_id = currVideo.id;
              camera.thumbnail = currVideo.thumbnail;
            }

            for (const item in currVideo.vehicle_breakdown) {
              newVehicleBreakdown[item] += currVideo.vehicle_breakdown[item];
            }
            camera.vehicle_breakdown = newVehicleBreakdown;
          }

          newCamerasList[Number(cameraId)] = camera;
        }

        setVideosReady(true);
        setAllVideos(videosProcessed)
        setAllCameras(newCamerasList);
      })
    } catch {

    } finally {
      setVideosReady(true);
    }
  }

  // handles adding new video data, after the initial load
  const addNewVideoDataFromId = async (newVideoId: number) => {
    setVideosReady(false);
    try {
      authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${newVideoId}`).then((r) => r.json())
      .then((videoData) => {
        if (!videoData.success) { return; }
        addNewVideoData(videoData.videos)
      })
    } catch (exception) {
      console.log(exception)
      setVideosReady(true);
    } finally {
    }
  }

  const addNewVideoData = async (videoData: any) => {
    setVideosReady(false);

    // get the id and parent, dispose if parent doesn't exist
    const videoId = videoData.id;
    const parent = getCameraSummaryFromId(videoData.camera)
    if (parent === null || videoId === undefined) { setVideosReady(true); return; };

    // create a new video for appending to our video list
    const newVideoList = allVideosRef.current;
    const newVideoSummary = convertObjectToVideoSummary(videoData)
    newVideoList[videoData] = newVideoSummary;
    setAllVideos(newVideoList);

    // update this object's parent accordingly
    if (!parent.video_count) parent.video_count = 0; 
    if (!parent.video_ids) parent.video_ids = [];
    parent.video_count++;
    parent.video_ids = parent.video_ids ? [...parent.video_ids, videoId] : [videoId];
    parent.vehicles += newVideoSummary.vehicles;
    parent.adb += newVideoSummary.occurrences;
    parent.speeding += newVideoSummary.speeding_count;
    parent.swerving += newVideoSummary.swerving_count;
    parent.abrupt_stopping += newVideoSummary.abrupt_stopping_count;
    for (const item in newVideoSummary.vehicle_breakdown) {
      parent.vehicle_breakdown[item] += newVideoSummary.vehicle_breakdown[item];
    }
    
    // update its latest upload only if necessary
    if (parent.latest_upload === null || parent.latest_upload < newVideoSummary.uploaded_at) {
      parent.latest_upload = newVideoSummary.uploaded_at;
      parent.latest_upload_id = newVideoSummary.id;
      parent.thumbnail = newVideoSummary.thumbnail;
    }
        
    // and set the newly updated data to our camera list
    const newCameraList = allCamerasRef.current;
    newCameraList[parent.id] = parent;
    setAllCameras(newCameraList);
  }
  //onComplete?: (fullData: any) => void




  // Auto-clear draw error after 4 seconds
  useEffect(() => {
    const ERROR_LENGTH_SECONDS = 4
    if (!drawError) return;
    const t = setTimeout(() => setDrawError(null), ERROR_LENGTH_SECONDS*1000);
    return () => clearTimeout(t);
  }, [drawError]);
  
  // checks if this object is present in the [Object]Record map 
  function idIsPresentInMap(type: SummaryType | "video", id: number): boolean {
    switch (type) {
      case "area":
        return id in allAoisRef.current

      case "subarea":
        return id in allSubareasRef.current

      case "camera":
        return id in allCamerasRef.current

      case "video":
        return id in allVideosRef.current
    }
  }

  // gets object from map (if present)

  function getLocationSummaryFromId(type: SummaryType | "video", id: number): null | AOISummary | SubAreaSummary | CameraSummary {
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

  // gets object from the allAois map (if present)
  function getAoiSummaryFromId(id: number): null | AOISummary {
    return (idIsPresentInMap("area", id))? allAoisRef.current[id] : null;
  }
  // gets object from the allAois map (if present)
  function getSubareaSummaryFromId(id: number): null | SubAreaSummary {
    return (idIsPresentInMap("subarea", id))? allSubareasRef.current[id] : null;
  }
  // gets object from the allAois map (if present)
  function getCameraSummaryFromId(id: number): null | CameraSummary {
    return (idIsPresentInMap("camera", id))? allCamerasRef.current[id] : null;
  }
  // gets object from the allAois map (if present)
  function getVideoSummaryFromId(id: number): null | VideoSummary {
    return (idIsPresentInMap("video", id))? allVideosRef.current[id] : null;
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

  // patches a single area/subarea/camera with new data
  const patchObjectInList = (type: SummaryType | "video", id: number, patchObject: any) => {
    if (!idIsPresentInMap(type, id)) return; // test first if it's even present

    // get object
    let newListObject;
    switch (type) {
      case "area": newListObject = allAoisRef.current; break;
      case "subarea": newListObject = allSubareasRef.current; break;
      case "camera": newListObject = allCamerasRef.current; break;
      case "video": newListObject = allVideosRef.current; break;
    }

    // patch in everything
    for (const key in patchObject) {
      const val = patchObject[key];
      newListObject[id][key] = val;
    }

    // return it in
    switch(type) {
      case "area": setAllAois(newListObject); break;
      case "subarea": setAllSubareas(newListObject); break;
      case "camera": setAllCameras(newListObject); break;
      case "video": setAllVideos(newListObject); break;
    }
  }







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
      
      setAtCameraLevel(false);
      // setAtCameraDetailLevel(false);
      // setSelectedCameraMapId(null);
      // setSubareaCameraIds(null);
      // setSubareaBounds(null);

    } else if (selectedAoiRef.current != null) {
      // back from AREA
      setSelectedAoiId(null);
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
    const thisObject = getLocationSummaryFromId(type, id);
    setEditName(thisObject.name);

    // set all relevant states
    setEditAction("rename")
    setEditId(id);
    setEditObjectType(type);
  }

  const handleStartDeletion = (type: SummaryType | "video", id: number) => {
    if (!idIsPresentInMap(type, id)) return; // quickfail

    let thisObject: LocationSummary | VideoSummary;
    if (type !== "video") {
      // get name; name has to be initialized before and stay initialized while editAction is not null
      thisObject = getLocationSummaryFromId(type, id);

      if (thisObject === null) return;
      // if thisObject has children: deny request
      if (isAreaSummary(thisObject) && thisObject.subarea_count > 0) {
        setDrawError(`Cannot delete the area ${thisObject.name}; please delete all its subareas firsts`); return;
      }
      if (isSubareaSummary(thisObject) && thisObject.camera_count > 0) {
        setDrawError(`Cannot delete the ${thisObject.sub_area_type.replaceAll("_", " ")} ${thisObject.name}; please delete all its cameras first`); return;
      }
      setEditName(thisObject.name);
    } else {
      thisObject = getVideoSummaryFromId(id);
      setEditName(thisObject.filename);
    }


    // set all relevant states
    setEditAction("delete")
    setEditId(id);
    setEditObjectType(type);
  }

  


  // checks whether childrenCoords (as either a single point or a bounding box) is within parent
  // assumes a [lng, lat] format for both sets of coordinates
  function checkBounds(parentCoords: [number, number][], childrenCoords: [number, number][] | [number, number]) {
    const parentLngs = parentCoords.map((p) => p[0]);
    const parentLats = parentCoords.map((p) => p[1]);
    const parentMinLng = Math.min(...parentLngs), parentMaxLng = Math.max(...parentLngs);
    const parentMinLat = Math.min(...parentLats), parentMaxLat = Math.max(...parentLats);
    
    // this function splits [number, number][] from [number, number]
    if ((childrenCoords[0] as Array<number>).length !== undefined) {
      // if [number, number][] — childrenCoords is a bounding box
      childrenCoords = childrenCoords as [number, number][]

      const childLngs = childrenCoords.map((p) => p[0]);
      const childLats = childrenCoords.map((p) => p[1]);
      const childMinLng = Math.min(...childLngs), childMaxLng = Math.max(...childLngs);
      const childMinLat = Math.min(...childLats), childMaxLat = Math.max(...childLats);

      if (childMinLng < parentMinLng || childMinLat < parentMinLat || childMaxLng > parentMaxLng || childMaxLat > parentMaxLat) return false;
      else return true;

    } else {
      // if [number, number] — childrenCoords is a single point
      childrenCoords = childrenCoords as [number, number]

      const childLng = childrenCoords[0]; const childLat = childrenCoords[1];
      if (childLng < parentMinLng || childLat < parentMinLat || childLng > parentMaxLng || childLat > parentMaxLat) return false;
      return true;
    }
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

    // get our parent as a const and throw an error if not within bounds of subarea
    const parent = (type === "subarea") ? getAoiSummaryFromId(parentId) : null; 
    if (parent && !checkBounds(parent.geometry, ring)) return;
    
    // set loading state
    setDrawIsLoading(true)

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

      } else if (type === "subarea") {
        // add to list of subareas
        const newSubarea = convertObjectToSubareaSummary(saved.saved_location ?? {...newObjectRaw, id: newId});
        const newSubareaList = allSubareasRef.current
        newSubareaList[newId] = newSubarea;
        setAllSubareas(newSubareaList)

        // update the parent area
        if (!parent.subarea_count) parent.subarea_count = 0; 
        if (!parent.subarea_ids) parent.subarea_ids = [];
        parent.subarea_count += 1;
        parent.subarea_ids = [...parent.subarea_ids, newId];
        const newAreaList = allAoisRef.current;
        newAreaList[parentId] = parent;
        setAllAois(newAreaList)
      }

      // done!
      forceTriggerRefresh();
      setDrawIsLoading(false);

    } catch (exception) {
      console.log(exception)
    } finally {
      // and done! do cleanup
      handleDrawingCleanup()
    }
  }, []);  

  // called once user places a camera on the map
  const handleCameraAdded = useCallback(async (lat: number, lng: number) => {
    // retrieve consts based on our states set earlier
    const type = drawTypeRef.current;
    const parentId = drawParentIdRef.current;

    // some of these are quickfails...
    if (type !== "camera" || parentId == null) return;

    // clean up edit menu and polygon in map
    handleDrawingCleanup()

    // get the parent, quickfail if it is not available
    const parentSubarea = getSubareaSummaryFromId(parentId)
    if (parentSubarea == null) return;

    // check if our camera is within our subarea's bounds and quickfail if not
    if (!checkBounds(parentSubarea.geometry, [lng, lat])) {
      setDrawError("Camera must be placed within the sub-area boundaries.");
      return
    };
    
    // set loading state
    setDrawIsLoading(true)

    try {
      // throw to API here...
      const body = { lat: lat, lng: lng, saved_location: parentId }
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());

      // unpack data sent by our api
      const saved = await res.json();
      const newId = saved.camera?.id
      if (newId == undefined) { throw new Error("Unable to get id of new object") }

      // add to list of cameras
      const newCamera = convertObjectToCameraSummary(saved.camera ?? {...body, id: newId});
      const newCameraList = allCamerasRef.current
      newCameraList[newId] = newCamera;
      setAllCameras(newCameraList)

      // update list of subareas
      if (!parentSubarea.camera_count) parentSubarea.camera_count = 0; 
      if (!parentSubarea.camera_ids) parentSubarea.camera_ids = [];
      parentSubarea.camera_count++;
      parentSubarea.camera_ids = [...parentSubarea.camera_ids, newId];
      const newSubareaList = allSubareasRef.current;
      setAllSubareas(newSubareaList);

      // done!
      forceTriggerRefresh();
      setDrawIsLoading(false);



    } catch (exception) {
      console.log(exception)
    } finally {
      // handle cleanup
      setDrawIsLoading(false);
      handleDrawingCleanup();
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
          // throw in a PATCH request to either cameras (for cameras) or saved-locations (for areas and subareas)
          const fetchLink = `${process.env.NEXT_PUBLIC_API_URL}/api/${type === "camera" ? "cameras" : "saved-locations"}/${id}/`
          const res = await authFetch(fetchLink, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newName }),
          });
          if (!res.ok) { console.log(await res.text()); return false; }

          // past this point, api success - patch the relevant data in our local copy
          patchObjectInList(type, id, {name: newName});

    } catch (exception) {
      console.log(exception)
    } finally {
      // cleanup
      handleEditClose()
      }
  }

  // handles a polygon being drawn
  const handlePolygonDrawn = async (id: number, polygon: [number, number][], onSuccess?: () => void) => {
    // quickfails: if camera doesn't exist or already has a polygon 
    const camera = getCameraSummaryFromId(id);
    if (!camera) return;
    // else if (camera.polygon != null && camera.polygon.length > 0) return;

    try {
      // perform our api call
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${id}/polygon/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ polygon: polygon }),
      })
      if (!res.ok) { console.log(await res.text()); return false; }

      // patching local copies...
      patchObjectInList("camera", id, {polygon: polygon})
      onSuccess();

    } catch (exception) {
      console.log(exception)
    } finally {

    }
    // onSuccess();
  }

  // asks the API to delete the given object
  const handleDeleteObject = async () =>  {
    if (editAction !== "delete") return; // quickfail
    
    const id = editId;
    const type = editObjectType;

    if (!idIsPresentInMap(type, id)) return; // quickfail
    
    setEditIsLoading(true);
    
    try {
      // deleting area or subarea
      if (type === "area" || type === "subarea") { 
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
      }
      
      // deleting camera
      else if (type === "camera") { 
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${id}/`, {
          method: "DELETE",
        })
        if (!res.ok) throw new Error(await res.text()); // throw error and shunt out

        // done — in this case, delete in our local camera list and update the subarea list accordingly
        if (selectedCameraRef.current === id) handleBack() // perform a return if this is selected

        const newAllCameras = allCamerasRef.current;
        const parentOfThis = newAllCameras[id].parent;
        delete newAllCameras[id];
        setAllCameras(newAllCameras);

        const newAllSubareas = allSubareasRef.current;
        newAllSubareas[parentOfThis].camera_count--;
        newAllSubareas[parentOfThis].camera_ids = newAllSubareas[parentOfThis].camera_ids.filter((x) => x !== id);
        setAllSubareas(newAllSubareas)
      }

      // deleting video
      else if (type === "video") {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${id}/`, { method: 'DELETE' })
        if (!res.ok) throw new Error(await res.text()); // throw error and shunt out

        // done — work on deleting this object and updating the camera to note this video's absence
        const newAllVideos = allVideosRef.current;
        const parentOfThis = newAllVideos[id].camera;
        delete newAllVideos[id];
        setAllVideos(newAllVideos);

        patchObjectInList("camera", parentOfThis, {
          video_count: allCamerasRef.current[parentOfThis].video_count - 1,
          video_ids: allCamerasRef.current[parentOfThis].video_ids.filter((x) => x !== id),
        })
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

  const handleEditCameraTags = async (id: number, newTags: string[]) => {
    // get camera in question
    const camera = getCameraSummaryFromId(id);
    if (!camera) return;


    try {
      // pass on request to api
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${id}/tags/`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: newTags }),
      }).then((r) => r.json())
      if (!res.success) return;
      
      // patch our local copy if successful
      patchObjectInList("camera", id, {tags: newTags});
      
    } catch (exception) {
      console.log(exception)
    } finally {

    }
  }

  // run when we are starting to upload a video
  const handleRequestUploadVideo = async (id: number) => {


    setEditId(id);
    setEditObjectType("camera");
    setEditAction("addVideo");
  }

  // run once we get all the user data to upload a video (given by CameraAddModal from cameraModals.tsx)
  const handleUploadStart = async (
    savedFile: File, videoName: string, cameraId: number,
    calibrationPoints: {x: number, y: number}[], originalReferencePoints: {x: number, y: number}[],
    referenceDistance: number, uploadThumbnail?: string
  ) => {

    // create our FormData for sending to the api
    const formData = new FormData();
    formData.append('file', savedFile);
    formData.append('video_name', videoName);
    formData.append('camera_id', cameraId.toString());
    formData.append('calibration_points', JSON.stringify(calibrationPoints));
    formData.append('reference_points', JSON.stringify(originalReferencePoints));
    formData.append('reference_distance_meters', referenceDistance.toString());
    if (uploadThumbnail) formData.append('thumbnail', uploadThumbnail);

    // console.log("Sending file:", formData)

    try {
      // upload video :)
      showToast(`Uploading "${videoName}"...`, "info");
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload_and_process/`, { method: 'POST', body: formData });

      // if fail, display a note — the user needs to know this
      if (!res.ok) {
        showToast("Failed to upload video", "error");
        return;
      }

      const data = await res.json();
      console.log(data);

      // else, note that we've finished processing and pass this onto the processing tracker
      // afterwards, pass the video data onto addNewVideoData()
      showToast(`"${videoName}" uploaded — processing started`, "info");
      trackVideoProcessing(videoName, data.video_id, (data) => { addNewVideoData(data.videos) })
    } catch (exception) {
      console.log(exception)
    } finally {}
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
          
          isDrawingAOI={isDrawing && (["area", "subarea"].includes(drawTypeRef.current))}  
          onAoiDrawn={handleAoiDrawn}

          isPlacingCamera={isDrawing && drawTypeRef.current === "camera"}
          onCameraAdd={handleCameraAdded}
          onPolygonDrawn={handlePolygonDrawn}

          hideEditControls={currentSelectionModeRef.current !== "camera"}
          cleanMap={selectedSubareaId == null}
          showGeocoder
          hoveredAoiId={hoveredAoiId}
          activeAoiId={highlightedAoiId}
          
          hideAoiMarkers={selectedAoiId != null}
          hideSubAreaMarkers={atCameraLevel}
          disableSubAreaInteraction={atCameraLevel}
          hoveredSubAreaId={hoveredSubAreaId}
          activeSubAreaId={highlightedSubareaId}
          onSubAreaHover={(id) => setHoveredSubAreaId(id)}
          cameraParentLocationId={selectedSubareaId}
          hideCameraPolygons={false}
        />
      </Box>

      {/* SideMenu */}
      <Box sx={{ position: "fixed", left: 0, top: 0, height: "100vh", zIndex: 10, overflowY: "auto" }}>
        <SideMenu
          locationSummariesLoading = {!locationSummariesReady}
          videosLoading = {!videosReady}
          allAois = {allAois}
          allSubareas = {allSubareas}
          allCameras = {allCameras}
          allVideos = {allVideos}
          
          selectedAOI={selectedAoiRef.current ? allAoisRef.current[selectedAoiRef.current] : null}
          selectedSubarea={selectedSubareaRef.current ? allSubareasRef.current[selectedSubareaRef.current] : null}
          selectedCamera={selectedCameraRef.current ? allCamerasRef.current[selectedCameraRef.current] : null}
          currentSelectionMode={currentSelectionModeRef.current}

          onNavigateTo={handleNavigateTo}
          onBack={handleBack}
          onCardClick={handleMapSelection}
          canStartDrawing={!drawIsLoadingRef.current}
          onStartDrawing={handleOnDrawingToggle}
          onRequestRename={handleStartEditingName}
          onRequestDelete={handleStartDeletion}

          onCameraUpload={handleRequestUploadVideo}

          onEditCameraTags={handleEditCameraTags}

          isDrawingAOI={isDrawingRef.current && drawTypeRef.current === "area"}
          isDrawingSubarea={(isDrawingRef.current && drawTypeRef.current === "subarea") ? drawSubareaTypeRef.current : false}
          isDrawingCamera={isDrawingRef.current && drawTypeRef.current === "camera"}

          onFeedTabActive={setIsFeedTabActive}
        />
      </Box>

      {/* Loading overlay - disabled currently */}
      {false && locationSummariesReady && (
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

      { /* Camera add video modal */ }
      <CameraAddModal
        open = { editAction === "addVideo" && editObjectType === "camera" }
        cameraId = { editId }
        onClose = { handleEditClose }
        onSubmit={ () => {} }
        onVideoFileSelect={ () => {} }

        onUploadStart={ handleUploadStart }
      />


    </Box>
  );
}