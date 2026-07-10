"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Box, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Button, IconButton, CircularProgress, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SideMenu from "@/components/landing/sideMenu";
import { parseVideoResolution } from "@/components/landing/sideMenu";
// import type { SideMenuUpdater } from "@/components/landing/sideMenu";
import { authFetch } from "@/lib/authFetch";
import {
  isLandingObjectsResponse,
  LandingAoiDto,
  LandingSubareaDto,
  LandingCameraDto,
  LandingVideoDto,
  isLandingVideoDto,
  isLandingVideoDetailResponse,
} from "@/lib/api/landingObjects";

import { CameraAddModal } from "@/components/landing/cameraModals";
import { useNotifications, setRunAfterProcessingCompleted } from "@/contexts/NotificationContext";
import {
  SubAreaType, SummaryType,
	LocationSummary, AOISummary, SubAreaSummary, CameraSummary,
	isAreaSummary, isSubareaSummary, isCameraSummary,
	convertObjectToAreaSummary, convertObjectToSubareaSummary, convertObjectToCameraSummary,
	VideoSummary, convertObjectToVideoSummary,
  AOIRecord, SubareaRecord, CameraRecord, VideoRecord,
  convertRecordToArray,
} from "@/components/landing/summaryTypes";

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
  const [recalibrateVideoId, setRecalibrateVideoId] = useState<number | null>(null);
  const [recalibrateThumbnail, setRecalibrateThumbnail] = useState<string | null>(null);

  // legacy states — move above when currently being used
  const [hoveredAoiId, setHoveredAoiId] = useState<number | null>(null);
  const [hoveredSubAreaId, setHoveredSubAreaId] = useState<number | null>(null);
  const selectedAoiIdRef = useRef<number | null>(null);
  selectedAoiIdRef.current = selectedAoiId;
  const selectedSubareaIdRef = useRef<number | null>(null);
  selectedSubareaIdRef.current = selectedSubareaId;

  // function to force update the side menu and map from anywhere
  const [currentRefreshTrigger, setCurrentRefreshTrigger] = useState<boolean>(false);
  const forceTriggerRefresh = () => { setCurrentRefreshTrigger(!setCurrentRefreshTrigger); }

  // prepare to bake some nice warm toast (enables the use of toasts)
  const { trackVideoProcessing, showToast } = useNotifications();





  // runs the below function on startup
  useEffect(() => {
      initialLoadLocationSummaries();
  }, [])

  const hydrateLandingObjects = (
    aoiData: LandingAoiDto[],
    subareaData: LandingSubareaDto[],
    cameraData: LandingCameraDto[],
    videoData: LandingVideoDto[],
  ) => {
    const aoisProcessed: AOIRecord = {}
    const subareasProcessed: SubareaRecord = {}
    const camerasProcessed: CameraRecord = {}
    const videosProcessed: VideoRecord = {}

    for (const curr of aoiData) {
      aoisProcessed[curr.id] = convertObjectToAreaSummary(curr, {
        subarea_ids: curr.subarea_ids ?? [],
        subarea_count: curr.subarea_count ?? (curr.subarea_ids ?? []).length,
      })
    }

    for (const curr of subareaData) {
      subareasProcessed[curr.id] = convertObjectToSubareaSummary(curr, {
        vehicle_breakdown: (curr.vehicle_breakdown ?? {}) as Record<string, number>,
        camera_ids: curr.camera_ids ?? [],
        camera_count: curr.camera_count ?? (curr.camera_ids ?? []).length,
      })
    }

    for (const curr of cameraData) {
      camerasProcessed[curr.id] = convertObjectToCameraSummary(curr, {
        video_ids: curr.video_ids ?? [],
        video_count: curr.video_count ?? (curr.video_ids ?? []).length,
      })
    }

    for (const curr of videoData) {
      videosProcessed[curr.id] = convertObjectToVideoSummary(curr)
    }

    setAllAois(aoisProcessed);
    setAllSubareas(subareasProcessed);
    setAllCameras(camerasProcessed);
    setAllVideos(videosProcessed);
  }

  // Initial fetch
  const initialLoadLocationSummaries = async () => {
    let cancelled = false;

    authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/landing-objects/`).then((r) => r.json()).then((payload: unknown) => {
      if (!isLandingObjectsResponse(payload) || !payload.success) { return; }
      hydrateLandingObjects(
        payload.aois ?? [],
        payload.subareas ?? [],
        payload.cameras ?? [],
        payload.videos ?? [],
      );
      setVideosReady(true);
    }).catch(() => {
      // error handling
      
    }).finally(() => {
      if (!cancelled) {
        setLocationSummariesReady(true);
        setVideosReady(true);
      }
    })
    return () => { cancelled = true; };
  };

  // handles adding new video data, after the initial load
  const addNewVideoDataFromId = async (newVideoId: number) => {
    setVideosReady(false);
    try {
      authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${newVideoId}`).then((r) => r.json())
      .then((videoData: unknown) => {
        if (!isLandingVideoDetailResponse(videoData) || !videoData.success || !videoData.videos) { return; }
        addNewVideoData(videoData.videos)
      })
    } catch (exception) {
      console.log(exception)
      setVideosReady(true);
    } finally {
    }
  }

  const addNewVideoData = async (videoData: LandingVideoDto) => {
    setVideosReady(false);

    // get the id and parent, dispose if parent doesn't exist
    const videoId = videoData.id;
    const parent = getCameraSummaryFromId(videoData.camera)
    if (parent === null || videoId === undefined) { setVideosReady(true); return; };

    // create a new video for appending to our video list
    const newVideoSummary = convertObjectToVideoSummary(videoData)
    setAllVideos((prev) => ({
      ...prev,
      [videoId]: newVideoSummary,
    }));

    // update this object's parent accordingly
    const parentVideoIds = parent.video_ids ?? [];
    const alreadyLinked = parentVideoIds.includes(videoId);
    const nextVideoIds = alreadyLinked ? parentVideoIds : [...parentVideoIds, videoId];
    const nextVideoCount = alreadyLinked ? (parent.video_count ?? parentVideoIds.length) : (parent.video_count ?? parentVideoIds.length) + 1;

    const updatedParent: CameraSummary = {
      ...parent,
      video_ids: nextVideoIds,
      video_count: nextVideoCount,
      vehicles: (parent.vehicles ?? 0) + (newVideoSummary.vehicles ?? 0),
      adb: (parent.adb ?? 0) + (newVideoSummary.occurrences ?? 0),
      speeding: (parent.speeding ?? 0) + (newVideoSummary.speeding_count ?? 0),
      swerving: (parent.swerving ?? 0) + (newVideoSummary.swerving_count ?? 0),
      abrupt_stopping: (parent.abrupt_stopping ?? 0) + (newVideoSummary.abrupt_stopping_count ?? 0),
    };
    
    // update its latest upload only if necessary
    if (updatedParent.latest_upload === null || updatedParent.latest_upload < newVideoSummary.uploaded_at) {
      updatedParent.latest_upload = newVideoSummary.uploaded_at;
    }

    // if not yet calibrated and video has calibration details, update
    if (!updatedParent.is_calibrated && videoData?.calibration_points && videoData?.reference_points) {
      updatedParent.is_calibrated = true;
      updatedParent.calibration_points = videoData.calibration_points
      updatedParent.reference_points = videoData.reference_points
      updatedParent.reference_distance_meters = videoData.reference_distance_meters
    }
        
    // and set the newly updated data to our camera list
    setAllCameras((prev) => ({
      ...prev,
      [parent.id]: updatedParent,
    }));

    // and done
    setVideosReady(true)
  }
  //onComplete?: (fullData: any) => void
  
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
    let currentListObject;
    switch (type) {
      case "area": currentListObject = allAoisRef.current; break;
      case "subarea": currentListObject = allSubareasRef.current; break;
      case "camera": currentListObject = allCamerasRef.current; break;
      case "video": currentListObject = allVideosRef.current; break;
    }

    const currentObj = currentListObject[id];
    if (!currentObj) return;

    const patched = { ...currentObj, ...patchObject };
    const nextListObject = {
      ...currentListObject,
      [id]: patched,
    };

    // return it in
    switch(type) {
      case "area": setAllAois(nextListObject); break;
      case "subarea": setAllSubareas(nextListObject); break;
      case "camera": setAllCameras(nextListObject); break;
      case "video": setAllVideos(nextListObject); break;
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
    setRecalibrateVideoId(null);
    setRecalibrateThumbnail(null);
  };

  const getLatestVideoForCamera = (cameraId: number): VideoSummary | null => {
    const videos = convertRecordToArray(allVideosRef.current)
      .filter((v) => v.camera === cameraId)
      .sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
    return videos.length > 0 ? videos[0] : null;
  };

  const handleRecalibrateCamera = async (cameraId: number) => {
    const camera = getCameraSummaryFromId(cameraId);
    if (!camera) return;

    const latestVideo = getLatestVideoForCamera(cameraId);
    if (!latestVideo) {
      showToast(`Cannot recalibrate camera "${camera.name}" because it has no uploaded videos yet`, "warning");
      return;
    }

    if (!latestVideo.thumbnail) {
      showToast(`Cannot recalibrate camera "${camera.name}" because the latest video has no first-frame thumbnail`, "warning");
      return;
    }

    setEditId(cameraId);
    setEditObjectType("camera");
    setEditAction("recalibrate");
    setRecalibrateVideoId(latestVideo.id);
    setRecalibrateThumbnail(latestVideo.thumbnail);
  };

  const handleSaveCameraCalibration = async (
    cameraId: number,
    calibrationPoints: {x: number, y: number}[],
    referencePoints: {x: number, y: number}[],
    referenceDistance: number,
    calibrationImageDimensions?: {width: number, height: number}
  ) => {


    const camera = getCameraSummaryFromId(cameraId);
    if (!camera) return;

    // adjust the calibration and reference points
    const recalibrateVideo = getVideoSummaryFromId(recalibrateVideoId);
    if (!recalibrateVideo) return;
    const originalImageDimensions = parseVideoResolution(recalibrateVideo.resolution)
    const rescalingCoefficientX = originalImageDimensions.width / calibrationImageDimensions.width
    const rescalingCoefficientY = originalImageDimensions.height / calibrationImageDimensions.height
    calibrationPoints = calibrationPoints.map((p) => { return { x: p.x * rescalingCoefficientX, y: p.y * rescalingCoefficientX } });
    referencePoints = referencePoints.map((p) => { return { x: p.x * rescalingCoefficientX, y: p.y * rescalingCoefficientX } });

    try {
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/calibration/`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calibration_points: calibrationPoints,
          reference_points: referencePoints,
          reference_distance_meters: referenceDistance,
        }),
      }).then((r) => r.json());

      if (!res.success) {
        showToast(res.error || `Failed to save recalibration for camera "${camera.name}"`, "error");
        return;
      }

      patchObjectInList("camera", cameraId, {
        is_calibrated: true,
        calibration_points: calibrationPoints,
        reference_points: referencePoints,
        reference_distance_meters: referenceDistance,
      });
      showToast(`Calibration updated for camera "${camera.name}"`, "success");
    } catch (exception) {
      console.log(exception);
      showToast(`Failed to save recalibration for camera "${camera.name}"`, "error");
    }
  }

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
        showToast(`Cannot delete the area "${thisObject.name}"; please delete all its subareas first`, "warning"); return;
      }
      if (isSubareaSummary(thisObject) && thisObject.camera_count > 0) {
        showToast(`Cannot delete the ${thisObject.sub_area_type.replaceAll("_", " ")} "${thisObject.name}"; please delete all its cameras first`, "warning"); return;
      }
      if (isCameraSummary(thisObject) && thisObject.video_count > 0) {
        showToast(`Cannot delete the camera "${thisObject.name}"; please delete all its videos first`, "warning"); return;
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
    if (parent && !checkBounds(parent.geometry, ring)) {
      showToast("Subarea must be placed within the area boundaries.", "warning");
      return;
    };
    
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
        setAllAois((prev) => ({
          ...prev,
          [newId]: newArea,
        }))

      } else if (type === "subarea") {
        // add to list of subareas
        const newSubarea = convertObjectToSubareaSummary(saved.saved_location ?? {...newObjectRaw, id: newId});
        setAllSubareas((prev) => ({
          ...prev,
          [newId]: newSubarea,
        }))

        // update the parent area
        setAllAois((prev) => {
          const existingParent = prev[parentId];
          if (!existingParent) return prev;

          const existingIds = existingParent.subarea_ids ?? [];
          const alreadyIncluded = existingIds.includes(newId);
          const nextIds = alreadyIncluded ? existingIds : [...existingIds, newId];

          return {
            ...prev,
            [parentId]: {
              ...existingParent,
              subarea_ids: nextIds,
              subarea_count: alreadyIncluded ? (existingParent.subarea_count ?? nextIds.length) : (existingParent.subarea_count ?? nextIds.length - 1) + 1,
            },
          };
        })
      }

      // done!
      showToast(`Successfully created a new ${type == "subarea" ? (subareaType.replace("_", " ")) : "area"}` , "success")
      forceTriggerRefresh();
      setDrawIsLoading(false);

    } catch (exception) {
      showToast(`Failed to create new ${type}`, "error")
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
      showToast("Camera must be placed within the subarea boundaries.", "warning");
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
      setAllCameras((prev) => ({
        ...prev,
        [newId]: newCamera,
      }))

      // update list of subareas
      setAllSubareas((prev) => {
        const existingSubarea = prev[parentId];
        if (!existingSubarea) return prev;

        const existingIds = existingSubarea.camera_ids ?? [];
        const alreadyIncluded = existingIds.includes(newId);
        const nextIds = alreadyIncluded ? existingIds : [...existingIds, newId];

        return {
          ...prev,
          [parentId]: {
            ...existingSubarea,
            camera_ids: nextIds,
            camera_count: alreadyIncluded ? (existingSubarea.camera_count ?? nextIds.length) : (existingSubarea.camera_count ?? nextIds.length - 1) + 1,
          },
        };
      });

      // done!
      showToast(`Successfully created a new camera` , "success")
      forceTriggerRefresh();
      setDrawIsLoading(false);



    } catch (exception) {
      showToast(`Failed to create new camera`, "error")
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

    const oldName = getLocationSummaryFromId(type, id)?.name;
    if (!oldName) return; // quickfail if this is null
    
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
          showToast(`Successfully renamed ${type} "${oldName}" to "${newName}"`, "success")

    } catch (exception) {
      showToast(`Failed to rename ${type} "${oldName}"`, "error")
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
      const existingPolygon = camera.polygon;
      let nextPolygons: [number, number][][] = [];
      if (Array.isArray(existingPolygon) && existingPolygon.length > 0) {
        const first = existingPolygon[0] as any;
        const isSinglePolygon =
          Array.isArray(first) &&
          first.length === 2 &&
          typeof first[0] === "number" &&
          typeof first[1] === "number";

        if (isSinglePolygon) {
          nextPolygons = [existingPolygon as [number, number][]];
        } else {
          const isPolygonCollection = (existingPolygon as any[]).every(
            (poly) =>
              Array.isArray(poly) &&
              poly.every(
                (pt: any) =>
                  Array.isArray(pt) &&
                  pt.length === 2 &&
                  typeof pt[0] === "number" &&
                  typeof pt[1] === "number",
              ),
          );
          if (isPolygonCollection) {
            nextPolygons = (existingPolygon as any[]).map(
              (poly) => poly as [number, number][],
            );
          }
        }
      }

      patchObjectInList("camera", id, {polygon: [...nextPolygons, polygon]})
      showToast(`Successfully set polygon to camera`, "success")
      onSuccess();

    } catch (exception) {
      showToast(`Failed to set polygon`, "error")
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
    const oldName = (type === "video" ? getVideoSummaryFromId(id).filename : getLocationSummaryFromId(type, id).name)
    
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
          setAllAois((prev) => {
            const { [id]: _removed, ...rest } = prev;
            return rest;
          });
        } else if (type === "subarea") {
          if (selectedSubareaRef.current === id) handleBack(); // perform a return if this is selected
          const parentOfThis = allSubareasRef.current[id]?.parent

          setAllSubareas((prev) => {
            const { [id]: _removed, ...rest } = prev;
            return rest;
          });

          if (parentOfThis != null) {
            setAllAois((prev) => {
              const existingParent = prev[parentOfThis];
              if (!existingParent) return prev;

              const nextIds = (existingParent.subarea_ids ?? []).filter((x) => x !== id);
              return {
                ...prev,
                [parentOfThis]: {
                  ...existingParent,
                  subarea_ids: nextIds,
                  subarea_count: Math.max(0, (existingParent.subarea_count ?? 0) - 1),
                },
              };
            });
          }
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

        const parentOfThis = allCamerasRef.current[id]?.parent;
        setAllCameras((prev) => {
          const { [id]: _removed, ...rest } = prev;
          return rest;
        });

        if (parentOfThis != null) {
          setAllSubareas((prev) => {
            const existingParent = prev[parentOfThis];
            if (!existingParent) return prev;

            const nextIds = (existingParent.camera_ids ?? []).filter((x) => x !== id);
            return {
              ...prev,
              [parentOfThis]: {
                ...existingParent,
                camera_ids: nextIds,
                camera_count: Math.max(0, (existingParent.camera_count ?? 0) - 1),
              },
            };
          });
        }
      }

      // deleting video
      else if (type === "video") {
        const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${id}/`, { method: 'DELETE' })
        if (!res.ok) throw new Error(await res.text()); // throw error and shunt out

        // done — work on deleting this object and updating the camera to note this video's absence
        const parentOfThis = allVideosRef.current[id]?.camera;
        setAllVideos((prev) => {
          const { [id]: _removed, ...rest } = prev;
          return rest;
        });

        if (parentOfThis != null && allCamerasRef.current[parentOfThis]) {
          patchObjectInList("camera", parentOfThis, {
            video_count: Math.max(0, (allCamerasRef.current[parentOfThis].video_count ?? 0) - 1),
            video_ids: (allCamerasRef.current[parentOfThis].video_ids ?? []).filter((x) => x !== id),
          })
        }
      }

      showToast(`Successfuly deleted ${type} "${oldName}"`, "success")

    } catch (exception) {
      showToast(`Failed to delete ${type} "${oldName}"`)
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
      showToast(`Successfully updated tags of camera "${camera.name}"`, "success")
      
    } catch (exception) {
      showToast(`Failed to update tags of camera "${camera.name}"`, "error")
      console.log(exception)
    } finally {

    }
  }

  const handleAutoDetectRoadFeatureTags = async (id: number) => {
    const camera = getCameraSummaryFromId(id);
    if (!camera) return;

    try {
      showToast("Running traffic sign detection on latest video...", "info");

      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${id}/detect-road-features/`, {
        method: "POST",
      }).then((r) => r.json());

      if (!res.success) {
        showToast(res.error || `Failed to auto-detect road features for camera \"${camera.name}\"`, "error");
        return;
      }

      const detectedTags = Array.isArray(res.road_features)
        ? res.road_features.filter((tag) => typeof tag === "string" && tag.trim().length > 0)
        : [];

      if (detectedTags.length === 0) {
        showToast(`No traffic signs detected for camera \"${camera.name}\"`, "warning");
        return;
      }

      const mergedTags = Array.from(new Set([...(camera.tags ?? []), ...detectedTags]));
      await handleEditCameraTags(id, mergedTags);
      showToast(`Auto-filled ${detectedTags.length} road feature tag(s) from latest video`, "success");
    } catch (exception) {
      console.log(exception);
      showToast(`Failed to auto-detect road features for camera \"${camera.name}\"`, "error");
    }
  }

  // run when we are starting to upload a video
  const handleRequestUploadVideo = async (id: number) => {
    setEditId(id);
    setEditObjectType("camera");
    setEditAction("addVideo");
  }

  // update the function on NotificationContext to reference variables in this scope
  setRunAfterProcessingCompleted((video: unknown) => {
    // run this bit once the video has been uploaded
    if (!isLandingVideoDto(video)) return;
    addNewVideoData(video);
    showToast(`Video "${video.filename ?? "unknown-video"}" has finished processing`, "success");
  });

  // run once we get all the user data to upload a video (given by CameraAddModal from cameraModals.tsx)
  const handleUploadStart = async (
    savedFile: File, videoName: string, cameraId: number, resolution: { width: number, height: number },
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

    try {

      // upload video :)
      showToast(`Uploading "${videoName}"...`, "info");
      const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload_and_process/`, { method: 'POST', body: formData });

      // if fail, display a note — the user needs to know this
      if (!res.ok) {
        showToast("Failed to upload video", "error");
        return;
      }

      // parse and add to current list as pending
      const data = await res.json();

      // Persist camera calibration in local state after a successful upload.
      patchObjectInList("camera", cameraId, {
        is_calibrated: true,
        calibration_points: calibrationPoints,
        reference_points: originalReferencePoints,
        reference_distance_meters: referenceDistance,
      });

      const pendingVideo: LandingVideoDto = {
        id: data.video_id, camera: cameraId, filename: videoName,
        calibration_points: calibrationPoints, reference_points: originalReferencePoints, reference_distance_meters: referenceDistance,
        duration_seconds: 0, vehicle_breakdown: {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0},
        uploaded_at: new Date().toISOString(), recorded_at: new Date().toISOString(),
        thumbnail: uploadThumbnail,
        processing_status: "pending"
      };

      addNewVideoData(pendingVideo);

      // else, note that we've finished processing and pass this onto the processing tracker
      // afterwards, pass the video data onto addNewVideoData()
      showToast(`"${videoName}" uploaded — processing started`, "info");
      trackVideoProcessing(videoName, data.video_id)
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
            currentSelectionModeRef.current === "camera" && selectedSubareaRef.current != null ?
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
          hideSubAreaMarkers={selectedCameraRef.current != null}
          disableSubAreaInteraction={selectedCameraRef.current != null}
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
          onAutoDetectRoadFeatures={handleAutoDetectRoadFeatureTags}
          onRecalibrateCamera={handleRecalibrateCamera}

          isDrawingAOI={isDrawingRef.current && drawTypeRef.current === "area"}
          isDrawingSubarea={(isDrawingRef.current && drawTypeRef.current === "subarea") ? drawSubareaTypeRef.current : false}
          isDrawingCamera={isDrawingRef.current && drawTypeRef.current === "camera"}
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
        open = { (editAction === "addVideo" || editAction === "recalibrate") && editObjectType === "camera" }
        cameraId = { editId }
        onClose = { handleEditClose }
        onSubmit={ () => {} }
        onVideoFileSelect={ () => {} }
        initialCalibrationPoints={editId ? getCameraSummaryFromId(editId)?.calibration_points : undefined}
        initialReferencePoints={editId ? getCameraSummaryFromId(editId)?.reference_points : undefined}
        initialReferenceDistance={editId ? getCameraSummaryFromId(editId)?.reference_distance_meters : undefined}
        editVideoId={editAction === "recalibrate" ? recalibrateVideoId : null}
        initialThumbnail={editAction === "recalibrate" ? recalibrateThumbnail : null}
        onCalibrationSaved={handleSaveCameraCalibration}

        onUploadStart={ handleUploadStart }
      />


    </Box>
  );
}