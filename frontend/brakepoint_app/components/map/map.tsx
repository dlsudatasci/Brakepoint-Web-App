"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import maplibregl from "maplibre-gl";
import MaplibreGeocoder, { MaplibreGeocoderApi, MaplibreGeocoderFeatureResults } from "@maplibre/maplibre-gl-geocoder";
import { MaplibreTerradrawControl } from "@watergis/maplibre-gl-terradraw";
import SideTab from "@components/map/sideTab";

import "@watergis/maplibre-gl-terradraw/dist/maplibre-gl-terradraw.css";
import "@maplibre/maplibre-gl-geocoder/dist/maplibre-gl-geocoder.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import ModeEditIcon from "@mui/icons-material/ModeEdit";

import { authFetch } from "@/lib/authFetch";
import {
  MAPILLARY_SOURCE_ID,
  MAPILLARY_LAYER_ID,
  mapillaryTileUrl,
  buildMapillaryFilter,
  buildIconImageExpression,
  loadSignImages,
  resolveBrakePointClass,
} from "@/lib/mapillary";

/*
    mapMode - how is this map used?
    — explore:    area/subarea creation for explore tab
    — map:        subarea configuration map with camera and polygon editing
    — heatmap:    subarea monitoring map with heatmap
    — dashboard:  simple map with subarea pins at the dashboard
*/
type MapMode = "explore" | "map" | "heatmap" | "dashboard";

/*
    toolMode - what is the currently active tool (for mapMode = "map")
      — none:         no tool is currently active; default map behavior
      — addCamera:    adds a camera on click
      — removeCamera: removes selected camera on click
      — addPoint:     adds a polygon point on click
      — removePoint:  removes a polygon on click
      — assignCamera: assigns a camera to a polygon area
*/
type ToolMode = "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint" | "assignCamera";

// location and details of a single camera
// obtained from api/cameras; class Camera in models.py
type Camera = {
  id: number | string;
  lat: number;
  lng: number;
  polygon?: [number, number][];
  occurrences?: number;
};

// a marker to display with mapMode = "dashboard"
type DashboardMarker = {
  id: number | string;
  lat: number;
  lng: number;
  label?: string;
  popupTitle?: string;
  popupBody?: string;
};

// a saved location; can be cached
// obtained from api/saved-locations; class SavedLocation in models.py
type SavedLocationRecord = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  geometry: [number, number][];
  bounds: [[number, number], [number, number]] | [number, number, number, number] | null;
  location_type: "aoi" | "sub_area" | "bookmark";
  parent_id: number | null;
};

// a completed polygon created by the user
type CompletedPolygon = {
  points: [number, number][];
  cameraId: number | string | null;
  occurrences?: number;
};

// a single TerraDraw feature
// obtained from TerraDraw.getSnapshot()
type TerraDrawFeature = {
  id: string;
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: [[number, number][]];
  };
  properties: {
    mode: "rectangle";
    selected?: boolean;
    [key: string]: any;
  };
};

// a focus area for TerraDraw to use for map panning, etc
type FocusArea = {
  kind: "primary" | "sub";
  label: string;
  ring: [number, number][];
  bbox: [number, number, number, number];
  paddedBbox: [number, number, number, number];
  minZoom: number;
};

/*
    explorePhase - what is the current state of the map (for mapMode = "explore")
    — idle:             map is idle
    — drawing-primary:  user is creating a new area
    — locked-primary:   map has been recently panned and locked to the primary AOI
    — drawing-sub:      user is creating a new subarea
*/
type ExplorePhase = "idle" | "drawing-primary" | "locked-primary" | "drawing-sub";

// definition of types for the props for Map
type MapProps = {
  mode: MapMode;                                                                            // how or where is this map used? enables certain features based on type of map

  dashboardMarkers?: DashboardMarker[];                                                     // markers to show (mode = "dashboard")
  onDashboardMarkerClick?: (id: DashboardMarker["id"]) => void;                             // triggers when a marker is clicked (mode = "dashboard")

  onCameraClick?: (cameraId: Camera["id"]) => void;                                         // triggers when a camera is clicked (mode = "map" | "heatmap")
  onCameraAdd?: (cameraId: Camera["id"], lat: number, lng: number, camera: Camera) => void; // triggers when user creates a camera (mode = "map" | "heatmap")
  onVisibleCamerasChange?: (visibleCameraIds: Camera["id"][]) => void;                      // triggers when list of cameras visible in the map changes (mode = "map" | "heatmap")
  onCamerasLoaded?: (cameras: Camera[]) => void;                                            // triggers when cameras are loaded for the first time (mode = "map" | "heatmap")
  selectedCameraId?: Camera["id"] | null;                                                   // the currently selected camera (mode = "map" | "heatmap")

  refreshTrigger: number;                                                                   // periodically incremented to refresh this Map object
  goTo?: [number, number] | null;                                                           // center coordinates for the map to pan to
  goToBounds?: [[number, number], [number, number]] | null;                                 // bounding box for the map to pan to
  mapMaxBounds?: [[number, number], [number, number]] | null;                               // when set, restricts panning to this padded bounding box
  subAreaItems?: { id: number; name: string; ring: [number, number][] }[] | null;          // sub-area polygons rendered when an AOI is selected

  showMapillarySigns?: boolean;                                                             // display map signs from mapillary?
  onMapReady?: (map: maplibregl.Map) => void;                                               // triggers when map has been loaded
  onAoiSaved?: () => void;                                                                  // called after a new AOI is saved (mode = "explore")
  hideEditControls?: boolean;                                                               // suppress camera editing buttons (mode = "map")
  cleanMap?: boolean;                                                                       // hide all cameras and polygons (landing page)
  isDrawingAOI?: boolean;                                                                   // enable lightweight rectangle drawing for AOI creation
  onAoiDrawn?: (ring: [number, number][], clearDrawing: () => void) => void;               // called when user finishes drawing a rectangle
  aoiItems?: { id: number; name: string; ring: [number, number][] }[];                     // AOI geometry rings to render as blue overlays
  hoveredAoiId?: number | null;                                                             // id of AOI card being hovered — highlights that polygon
  onAoiClick?: (id: number) => void;                                                        // fired when user clicks an AOI polygon
  hoveredSubAreaId?: number | null;                                                         // id of road segment card being hovered — highlights that orange polygon
  onSubAreaClick?: (id: number) => void;                                                    // fired when user clicks a sub-area polygon
  onSubAreaHover?: (id: number | null) => void;                                             // fired when user hovers/leaves a sub-area polygon
  showGeocoder?: boolean;                                                                   // show the search bar (landing page)
};

// a MapLibre marker for each subarea (mode = "dashboard")
type DashMarkerEntry = {
  marker: maplibregl.Marker;
  popup?: maplibregl.Popup;
  popupRoot?: ReactDOM.Root;
  el: HTMLElement;
  labelEl: HTMLElement;
};

// a MapLibre marker for each camera (mode = "map" | "heatmap")
type CameraMarkerEntry = {
  id: number | string;
  marker: maplibregl.Marker;
  lat: number;
  lng: number;
  element: HTMLElement;
};

function normalizeBounds(bounds: SavedLocationRecord["bounds"], ring: [number, number][]): [number, number, number, number] {
  if (Array.isArray(bounds) && bounds.length === 4 && typeof bounds[0] === "number") {
    return bounds as [number, number, number, number];
  }

  if (Array.isArray(bounds) && bounds.length === 2 && Array.isArray(bounds[0]) && Array.isArray(bounds[1])) {
    return [bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]];
  }

  return rectToBoundingBox(ring);
}

// converts a SavedLocationRecord object (obtained through api, etc) to a format suitable for FocusArea
function savedLocationToFocusArea(loc: SavedLocationRecord, kind: "primary" | "sub"): FocusArea | null {
  if (!loc.geometry || loc.geometry.length < 4) return null;

  const ring = loc.geometry;
  const bbox = normalizeBounds(loc.bounds, ring);

  return {
    kind,
    label: loc.name,
    ring,
    bbox,
    paddedBbox: expandBbox(bbox, kind === "sub" ? 0.04 : 0.08),
    minZoom: 14,
  };
}

function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

function ensureClosedRing(points: [number, number][]) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return points;
  return [...points, first];
}

function rectToBoundingBox(rect: [number, number][]) {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of rect) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLng, minLat, maxLng, maxLat] as [number, number, number, number];
}

function expandBbox(bbox: [number, number, number, number], pct = 0.05): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const dx = (maxLng - minLng) * pct;
  const dy = (maxLat - minLat) * pct;
  return [minLng - dx, minLat - dy, maxLng + dx, maxLat + dy];
}

function bboxToBoundsLike(bbox: [number, number, number, number]): maplibregl.LngLatBoundsLike {
  return [
    [bbox[0], bbox[1]],
    [bbox[2], bbox[3]],
  ];
}

function bboxContains(outer: [number, number, number, number], inner: [number, number, number, number]) {
  return inner[0] >= outer[0] && inner[1] >= outer[1] && inner[2] <= outer[2] && inner[3] <= outer[3];
}

function bboxCenter(bbox: [number, number, number, number]): [number, number] {
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function createFocusMask(ring: [number, number][]) {
  return {
    type: "Feature" as const,
    properties: {
      kind: "mask",
      label: "",
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [-180, -90],
          [180, -90],
          [180, 90],
          [-180, 90],
          [-180, -90],
        ],
        ensureClosedRing(ring),
      ],
    },
  };
}

function disableRotationInteractions(map: maplibregl.Map) {
  map.dragRotate.disable();
  map.touchPitch.disable();
  map.touchZoomRotate.disableRotation();
  map.keyboard.disable();
  map.doubleClickZoom.enable();
  map.scrollZoom.enable();
  map.boxZoom.enable();
  map.dragPan.enable();
}

// deprecated -cy
class ToggleEditButton implements maplibregl.IControl {
  private onToggle: (isEdit: boolean) => void;
  private container: HTMLElement | null = null;
  private isEditMode = false;

  constructor(onToggle: (isEdit: boolean) => void) {
    this.onToggle = onToggle;
  }

  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    const btn = document.createElement("button");
    btn.title = "Toggle Edit Mode";
    ReactDOM.createRoot(btn).render(<ModeEditIcon sx={{ width: 16 }} />);

    btn.onclick = () => {
      this.isEditMode = !this.isEditMode;
      btn.style.backgroundColor = this.isEditMode ? "#e0e4e9ff" : "";
      this.onToggle(this.isEditMode);
    };

    this.container.appendChild(btn);
    return this.container;
  }

  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
  }
}

class createToggleButtons implements maplibregl.IControl {
  private onToggle: (toolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint" ) => void;
  private container: HTMLElement | null = null;
  private toolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint" = "none";
  private allBtns: {
    "addCamera": HTMLElement | null;
    "removeCamera": HTMLElement | null;
    "addPoint": HTMLElement | null;
    "removePoint": HTMLElement | null;
  } = {"addCamera": null, "removeCamera": null, "addPoint": null, "removePoint": null};

  constructor(onToggle: (toolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint" ) => void) {
    this.onToggle = onToggle;
  }

  // updates the button styles
  updateButtonStyles = (
    oldToolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint",
    newToolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint",
  ) => {
    if (oldToolMode != "none") {
      this.allBtns[oldToolMode].style.backgroundColor = "";
    }
    if (newToolMode != "none") {
      this.allBtns[newToolMode].style.backgroundColor = "#e0e4e9ff";
    }
  }

  // triggers when one of the buttons in this edit button selection is toggled on/off
  onButtonClick = (
    btnToolMode: "none" | "addCamera" | "removeCamera" | "addPoint" | "removePoint"
  ) => {
    // disable the tool
    if (this.toolMode == btnToolMode) {
      this.updateButtonStyles(this.toolMode, "none");
      this.toolMode = "none";
    }
    // enables this tool
    else if (this.toolMode == "none") {
      this.updateButtonStyles("none", btnToolMode);
      this.toolMode = btnToolMode;
    }
    // switches to a new tool
    else {
      this.updateButtonStyles(this.toolMode, btnToolMode);
      this.toolMode = btnToolMode;
    }
    this.onToggle(this.toolMode);
  }

  onAdd() {
    // create base container
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    // create buttons
    for (const newBtnName of Object.keys(this.allBtns)) {
      this.allBtns[newBtnName] = document.createElement("button")
    }

    // tooltip titles
    this.allBtns.addCamera.title = "Add camera";
    this.allBtns.removeCamera.title = "Remove camera";
    this.allBtns.addPoint.title = "Add point";
    this.allBtns.removePoint.title = "Remove point";

    // render icon for the toolbar
    ReactDOM.createRoot(this.allBtns.addCamera).render(<ModeEditIcon sx={{ width: 16 }} />);
    ReactDOM.createRoot(this.allBtns.removeCamera).render(<ModeEditIcon sx={{ width: 16 }} />);
    ReactDOM.createRoot(this.allBtns.addPoint).render(<ModeEditIcon sx={{ width: 16 }} />);
    ReactDOM.createRoot(this.allBtns.removePoint).render(<ModeEditIcon sx={{ width: 16 }} />);

    // on-click triggers
    this.allBtns.addCamera.onclick = () => { this.onButtonClick("addCamera") };
    this.allBtns.removeCamera.onclick = () => { this.onButtonClick("removeCamera") };
    this.allBtns.addPoint.onclick = () => { this.onButtonClick("addPoint") };
    this.allBtns.removePoint.onclick = () => { this.onButtonClick("removePoint") };

    // add all buttons to container
    for (const newBtn of Object.values(this.allBtns)) {
      this.container.appendChild(newBtn);
    }

    // return container
    return this.container;
  }

  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
  }
}

class createPolygonEditButtons implements maplibregl.IControl {
  private onToggle: (type: "undo" | "discard") => void;
  private container: HTMLElement | null = null;
  private allBtns: {
    "undo": HTMLElement | null;
    "discard": HTMLElement | null;
  } = { "undo": null, "discard": null }


  constructor( onToggle: (type: "undo" | "discard") => void ) {
    this.onToggle = onToggle;
  }

  onAdd() {
    // create base container
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    // create buttons
    for (const newBtnName of Object.keys(this.allBtns)) {
      this.allBtns[newBtnName] = document.createElement("button")
    }

    // tooltip titles
    this.allBtns.undo.title = "Undo last point";
    this.allBtns.discard.title = "Discard current polygon";

    // render icon for the toolbar
    ReactDOM.createRoot(this.allBtns.undo).render(<ModeEditIcon sx={{ width: 16 }} />);
    ReactDOM.createRoot(this.allBtns.discard).render(<ModeEditIcon sx={{ width: 16 }} />);

    // on-click triggers
    this.allBtns.undo.onclick = () => { this.onToggle("undo") };
    this.allBtns.discard.onclick = () => { this.onToggle("discard") };

    // add all buttons to container
    for (const newBtn of Object.values(this.allBtns)) {
      this.container.appendChild(newBtn);
    }

    // return container
    return this.container;
  };

  onRemove() {
    this.container?.parentNode?.removeChild(this.container);
    this.container = null;
  }

}

export default function MapView({
  mode,
  dashboardMarkers,
  onDashboardMarkerClick,
  onCameraClick,
  onCameraAdd,
  onVisibleCamerasChange,
  onCamerasLoaded,
  selectedCameraId,
  refreshTrigger,
  goTo,
  goToBounds,
  showMapillarySigns = true,
  onMapReady,
  onAoiSaved,
  hideEditControls = false,
  cleanMap = false,
  isDrawingAOI = false,
  onAoiDrawn,
  aoiItems,
  hoveredAoiId,
  onAoiClick,
  hoveredSubAreaId,
  onSubAreaClick,
  onSubAreaHover,
  showGeocoder = false,
  mapMaxBounds,
  subAreaItems,
}: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // Becomes true once the map's "load" event fires (style JSON applied, safe to add layers)
  const mapLoadedRef = useRef(false);

  const [open, setOpen] = useState(true);

  const [isEditMode, setIsEditMode] = useState(true);
  const [toolMode, setToolMode] = useState<ToolMode>("none");

  const [showPolygonModal, setShowPolygonModal] = useState(false);
  const [cameras, setCameras] = useState<CameraMarkerEntry[]>([]);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [completedPolygons, setCompletedPolygons] = useState<CompletedPolygon[]>([]);
  const [selectedPolygonIndex, setSelectedPolygonIndex] = useState<number | null>(null);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);


  const [exploreInitFromCache] = useState<{
    savedAoiId: number;
    savedSubAreaIds: Record<number, number>;
    primaryFocusArea: FocusArea;
    subFocusAreas: FocusArea[];
  } | null>(() => {
    if (mode !== "explore") return null;
    if (onAoiSaved) return null;
    try {
      const raw = sessionStorage.getItem("bp_explore_v1");
      if (!raw) return null;
      const locs = JSON.parse(raw) as SavedLocationRecord[];
      const savedAoi = locs.find((l) => l.location_type === "aoi");
      if (!savedAoi) return null;
      const nextPrimary = savedLocationToFocusArea(savedAoi, "primary");
      if (!nextPrimary) return null;
      const savedSubs = locs.filter(
        (l) => l.location_type === "sub_area" && l.parent_id === savedAoi.id,
      );
      const nextSubAreas: FocusArea[] = [];
      const nextSavedSubAreaIds: Record<number, number> = {};
      savedSubs.forEach((loc, index) => {
        const area = savedLocationToFocusArea(loc, "sub");
        if (!area) return;
        nextSubAreas.push(area);
        nextSavedSubAreaIds[index] = loc.id;
      });
      return {
        savedAoiId: savedAoi.id,
        savedSubAreaIds: nextSavedSubAreaIds,
        primaryFocusArea: nextPrimary,
        subFocusAreas: nextSubAreas,
      };
    } catch {
      return null;
    }
  });

  const [primaryFocusArea, setPrimaryFocusArea] = useState<FocusArea | null>(
    exploreInitFromCache?.primaryFocusArea ?? null,
  );
  const [subFocusAreas, setSubFocusAreas] = useState<FocusArea[]>(
    exploreInitFromCache?.subFocusAreas ?? [],
  );
  const [activeSubAreaIndex, setActiveSubAreaIndex] = useState<number | null>(null);
  const [explorePhase, setExplorePhase] = useState<ExplorePhase>(
    exploreInitFromCache ? "locked-primary" : "idle",
  );
  const [focusError, setFocusError] = useState<string | null>(null);
  const [hoverSubAreaIndex, setHoverSubAreaIndex] = useState<number | null>(null);
  const [selectedSubAreaIndex, setSelectedSubAreaIndex] = useState<number | null>(null);

  const camerasRef = useRef<CameraMarkerEntry[]>([]);
  const dashboardRegistryRef = useRef<Map<string, DashMarkerEntry>>(new Map());
  const openDashboardPopupRef = useRef<maplibregl.Popup | null>(null);

  const editControlRef = useRef<createToggleButtons | null>(null);
  const polygonEditControlRef = useRef<createPolygonEditButtons | null>(null);
  const geocoderControlRef = useRef<MaplibreGeocoder | null>(null);
  const drawControlRef = useRef<MaplibreTerradrawControl | null>(null);

  const rectIdRef = useRef<string | null>(null);
  const lockAfterFitRef = useRef(false);
  const isFirstGoToRef = useRef(true);
  const enforcingRef = useRef(false);
  const defaultMinZoomRef = useRef(0);
  const defaultMaxZoomRef = useRef(22);
  const loadAbortRef = useRef<AbortController | null>(null);

  const toolModeRef = useLatestRef(toolMode);
  const selectedPolygonIndexRef = useLatestRef(selectedPolygonIndex);
  const completedPolygonsRef = useLatestRef(completedPolygons);
  const polygonPointsRef = useLatestRef(polygonPoints);
  const primaryFocusAreaRef = useLatestRef(primaryFocusArea);
  const subFocusAreasRef = useLatestRef(subFocusAreas);
  const activeSubAreaIndexRef = useLatestRef(activeSubAreaIndex);
  const explorePhaseRef = useLatestRef(explorePhase);
  const selectedSubAreaIndexRef = useLatestRef(selectedSubAreaIndex);
  const modeRef = useLatestRef(mode);
  const goToRef = useLatestRef(goTo ?? null);
  const goToBoundsRef = useLatestRef(goToBounds ?? null);
  const onAoiSavedRef = useLatestRef(onAoiSaved ?? null);
  const onAoiDrawnRef = useLatestRef(onAoiDrawn ?? null);
  const onAoiClickRef = useLatestRef(onAoiClick ?? null);
  const onSubAreaClickRef = useLatestRef(onSubAreaClick ?? null);
  const onSubAreaHoverRef = useLatestRef(onSubAreaHover ?? null);
  const isDrawingAOIRef = useRef(isDrawingAOI);
  isDrawingAOIRef.current = isDrawingAOI;
  const lastDrawingFinishTimeRef = useRef(0);
  const aoiDrawControlRef = useRef<MaplibreTerradrawControl | null>(null);
  const [savedAoiId, setSavedAoiId] = useState<number | null>(
    exploreInitFromCache?.savedAoiId ?? null,
  );
  const [savedSubAreaIds, setSavedSubAreaIds] = useState<Record<number, number>>(
    exploreInitFromCache?.savedSubAreaIds ?? {},
  );

  const hasLoadedExploreAreasRef = useRef(false);

  // const style = "https://tiles.openfreemap.org/styles/liberty";
  const style = "./map-style.json"
  const lng = 120.9842;
  const lat = 14.5995;
  const zoom = 10;

  const isAssigningCamera = toolMode === "assignCamera";
  const isDrawingPrimary = explorePhase === "drawing-primary";
  const isDrawingSub = explorePhase === "drawing-sub";
  const isDrawingFocusArea = isDrawingPrimary || isDrawingSub;
  const hasConfirmedPrimary = !!primaryFocusArea;
  const hasSelectedSubArea = selectedSubAreaIndex != null;

  const geocoderApi: MaplibreGeocoderApi = useMemo(() => ({
    forwardGeocode: async (config: { query: string }): Promise<MaplibreGeocoderFeatureResults> => {
      const features: any[] = [];

      try {
        const request = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          config.query,
        )}&format=geojson&polygon_geojson=1&addressdetails=1&limit=5`;

        const response = await fetch(request);
        const geojson = await response.json();

        for (const feature of geojson.features ?? []) {
          const center = [feature.bbox[0] + (feature.bbox[2] - feature.bbox[0]) / 2, feature.bbox[1] + (feature.bbox[3] - feature.bbox[1]) / 2];

          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: center },
            place_name: feature.properties?.display_name ?? "",
            properties: feature.properties ?? {},
            text: feature.properties?.display_name ?? "",
            place_type: ["place"],
            center,
          });
        }
      } catch (e) {
        console.error(`Failed to forwardGeocode with error: ${e}`);
      }

      return {
        type: "FeatureCollection",
        features,
      };
    },
  }), []);

  const reverseGeocodeAreaName = useCallback(async (bbox: [number, number, number, number], fallback: string) => {
    const [lngCenter, latCenter] = bboxCenter(bbox);

    try {
      const request = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(String(latCenter))}&lon=${encodeURIComponent(
        String(lngCenter),
      )}&format=jsonv2&zoom=16&addressdetails=1`;

      const response = await fetch(request, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return fallback;

      const data = await response.json();
      const address = data?.address ?? {};

      return (
        address.neighbourhood ||
        address.suburb ||
        address.quarter ||
        address.city_district ||
        address.hamlet ||
        address.village ||
        address.town ||
        address.city ||
        address.municipality ||
        data?.name ||
        (typeof data?.display_name === "string" ? data.display_name.split(",")[0] : fallback) ||
        fallback
      );
    } catch {
      return fallback;
    }
  }, []);

  // MAP INITIALIZATION

  const VIEWPORT_CACHE_KEY = "bp_viewport_v1";

  const EXPLORE_VIEWPORT_KEY = "bp_explore_viewport_v1";

  const createMap = useCallback(() => {
    let initCenter: [number, number] = [lng, lat];
    let initZoom = zoom;

    if (goToRef.current) {
      initCenter = goToRef.current;
      initZoom = 18;
    } else {
      try {
        const vKey = modeRef.current === "explore" ? EXPLORE_VIEWPORT_KEY : VIEWPORT_CACHE_KEY;
        const raw = sessionStorage.getItem(vKey);
        if (raw) {
          const v = JSON.parse(raw);
          if (v.center && typeof v.zoom === "number") {
            initCenter = v.center;
            initZoom = v.zoom;
          }
        }
      } catch {}
    }
    return new maplibregl.Map({
      container: mapContainer.current!,
      style,
      center: initCenter,
      zoom: initZoom,
      pitch: 0,
    });

  }, []);

  const restoreDefaultExploreCamera = useCallback((map: maplibregl.Map) => {
    map.setMaxBounds(null as any);
    map.setMinZoom(defaultMinZoomRef.current);
    map.setMaxZoom(defaultMaxZoomRef.current);
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.boxZoom.enable();
    map.doubleClickZoom.enable();
    map.dragRotate.disable();
    map.touchPitch.disable();
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();
  }, []);

  const add3DBuildingsLayer = useCallback((map: maplibregl.Map) => {
    const layers = map.getStyle().layers ?? [];
    const firstSymbolId = layers.find((l) => l.type === "symbol")?.id;

    if (!map.getSource("openmaptiles")) return;

    if (!map.getLayer("3d-buildings")) {
      map.addLayer(
        {
          id: "3d-buildings",
          source: "openmaptiles",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "render_height"]],
            "fill-extrusion-base": ["interpolate", ["linear"], ["zoom"], 15, 0, 15.05, ["get", "render_min_height"]],
            "fill-extrusion-opacity": 0.6,
          },
        },
        firstSymbolId,
      );
    }
  }, []);

  // HEATMAP

  const addHeatmapLayers = useCallback((map: maplibregl.Map) => {
    if (!map.getSource("earthquakes")) {
      map.addSource("earthquakes", {
        type: "geojson",
        data: "https://maplibre.org/maplibre-gl-js/docs/assets/earthquakes.geojson",
      });
    }

    if (!map.getLayer("earthquakes-heat")) {
      map.addLayer({
        id: "earthquakes-heat",
        type: "heatmap",
        source: "earthquakes",
        maxzoom: 9,
        paint: {
          "heatmap-weight": ["interpolate", ["linear"], ["get", "mag"], 0, 0, 6, 1],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 9, 3],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(33,102,172,0)",
            0.2,
            "rgb(103,169,207)",
            0.4,
            "rgb(209,229,240)",
            0.6,
            "rgb(253,219,199)",
            0.8,
            "rgb(239,138,98)",
            1,
            "rgb(178,24,43)",
          ],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 9, 20],
          "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 7, 1, 9, 0],
        },
      });
    }

    if (!map.getLayer("earthquakes-point")) {
      map.addLayer({
        id: "earthquakes-point",
        type: "circle",
        source: "earthquakes",
        minzoom: 7,
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            7,
            ["interpolate", ["linear"], ["get", "mag"], 1, 1, 6, 4],
            16,
            ["interpolate", ["linear"], ["get", "mag"], 1, 5, 6, 50],
          ],
          "circle-stroke-color": "white",
          "circle-stroke-width": 1,
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 7, 0, 8, 1],
        },
      });
    }
  }, []);

  const removeHeatmapLayers = useCallback((map: maplibregl.Map) => {
    if (map.getLayer("earthquakes-point")) map.removeLayer("earthquakes-point");
    if (map.getLayer("earthquakes-heat")) map.removeLayer("earthquakes-heat");
    if (map.getSource("earthquakes")) map.removeSource("earthquakes");
  }, []);

  // DASHBOARD MODE

  const cleanupDashEntry = (entry: DashMarkerEntry) => {
    try {
      entry.popupRoot?.unmount();
    } catch {}
    try {
      entry.popup?.remove();
    } catch {}
    try {
      entry.marker.remove();
    } catch {}
  };

  const makeDashboardMarkerElement = (label: string | undefined) => {
    const el = document.createElement("div");
    el.className = "dash-marker";

    const pin = document.createElement("div");
    pin.className = "dash-marker__pin";

    const labelEl = document.createElement("div");
    labelEl.className = "dash-marker__label";
    labelEl.textContent = label ?? "";

    pin.appendChild(labelEl);
    el.appendChild(pin);

    return { el, labelEl };
  };

  const openDashboardPopup = (map: maplibregl.Map, entry: DashMarkerEntry, m: DashboardMarker) => {
    openDashboardPopupRef.current?.remove();
    openDashboardPopupRef.current = null;

    const host = document.createElement("div");
    host.className = "dash-popup";

    const popup = new maplibregl.Popup({
      offset: 16,
      closeButton: true,
      closeOnClick: true,
      maxWidth: "360px",
    }).setDOMContent(host);

    const root = ReactDOM.createRoot(host);
    root.render(
      <div className="dash-popup__content">
        <div className="dash-popup__title">{m.popupTitle ?? m.label ?? "Marker"}</div>
        {m.popupBody ? (
          <div className="dash-popup__body">{m.popupBody}</div>
        ) : (
          <div className="dash-popup__coords">
            {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
          </div>
        )}
      </div>,
    );

    popup.on("close", () => {
      try {
        root.unmount();
      } catch {}
    });

    entry.marker.setPopup(popup);
    entry.popup = popup;
    entry.popupRoot = root;
    openDashboardPopupRef.current = popup;
    entry.marker.togglePopup();
  };

  // EXPLORE MODE

  function getPolygonCentroid(coords: [number, number][]) {
    const lng = coords.reduce((sum, p) => sum + p[0], 0) / coords.length;
    const lat = coords.reduce((sum, p) => sum + p[1], 0) / coords.length;
    return { lng, lat };
  }

  function getPolygonBounds(coords: [number, number][]) {
    const lngs = coords.map((p) => p[0]);
    const lats = coords.map((p) => p[1]);

    return [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
  }

  const createSavedArea = useCallback(
    async ({
      name,
      coords,
      locationType,
      parentId = null,
    }: {
      name: string;
      coords: [number, number][];
      locationType: "aoi" | "sub_area";
      parentId?: number | null;
    }) => {
      const centroid = getPolygonCentroid(coords);
      const bounds = getPolygonBounds(coords);

      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: centroid.lat,
          lng: centroid.lng,
          geometry: coords,
          bounds,
          location_type: locationType,
          parent_id: parentId,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Create saved area failed:", response.status, text);
        throw new Error(`Failed to create saved area: ${response.status}`);
      }

      const data = await response.json();
      return data.saved_location;
    },
    [],
  );

  const updateSavedArea = useCallback(
    async ({ id, name, coords, parentId }: { id: number; name: string; coords: [number, number][]; parentId?: number | null }) => {
      const centroid = getPolygonCentroid(coords);
      const bounds = getPolygonBounds(coords);

      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          lat: centroid.lat,
          lng: centroid.lng,
          geometry: coords,
          bounds,
          parent_id: parentId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update saved area");
      }
    },
    [],
  );

  const deleteSavedArea = useCallback(async (id: number) => {
    const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/${id}/`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete saved area");
    }
  }, []);

  const clearTerradrawSelection = useCallback(() => {
    try {
      const control = drawControlRef.current;
      if (!control) {
        rectIdRef.current = null;
        return;
      }

      const di = control.getTerraDrawInstance?.();
      if (!di) {
        rectIdRef.current = null;
        return;
      }

      let snapshot: TerraDrawFeature[] = [];
      try {
        snapshot = (di.getSnapshot?.() ?? []) as TerraDrawFeature[];
      } catch {
        rectIdRef.current = null;
        return;
      }

      snapshot.forEach((feature) => {
        try {
          di.removeFeatures?.([String(feature.id)]);
        } catch {

        }
      });

      rectIdRef.current = null;
    } catch {
      rectIdRef.current = null;
    }
  }, []);

  const applyLockedFocusToMap = useCallback((area: FocusArea) => {
    const map = mapRef.current;
    if (!map) return;

    if (lockAfterFitRef.current) return;
    lockAfterFitRef.current = true;

    map.fitBounds(bboxToBoundsLike(area.bbox), { padding: 40, duration: 500 });

    map.once("idle", () => {
      requestAnimationFrame(() => {
        const fittedZoom = map.getZoom();
        map.setMaxBounds(bboxToBoundsLike(area.paddedBbox));
        map.setMinZoom(fittedZoom);
        map.setMaxZoom(Math.max(fittedZoom + 6, 18));
        disableRotationInteractions(map);
        lockAfterFitRef.current = false;

        try {
          sessionStorage.setItem(
            EXPLORE_VIEWPORT_KEY,
            JSON.stringify({ center: map.getCenter().toArray(), zoom: map.getZoom() }),
          );
        } catch {}
      });
    });
  }, []);

  const startPrimaryDrawingMode = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    restoreDefaultExploreCamera(map);
    clearTerradrawSelection();
    setFocusError(null);
    setPrimaryFocusArea(null);
    setSubFocusAreas([]);
    setActiveSubAreaIndex(null);
    setSelectedSubAreaIndex(null);
    setExplorePhase("drawing-primary");

    const trySetRectangleMode = () => {
      try {
        const di = drawControlRef.current?.getTerraDrawInstance?.();
        if (!di) return false;
        di.setMode?.("rectangle");
        return true;
      } catch {
        return false;
      }
    };

    if (trySetRectangleMode()) return;

    requestAnimationFrame(() => {
      if (trySetRectangleMode()) return;
      setTimeout(() => {
        trySetRectangleMode();
      }, 0);
    });
  }, [clearTerradrawSelection, restoreDefaultExploreCamera]);

  const EXPLORE_CACHE_KEY = "bp_explore_v1";

  const applyExploreLocations = useCallback(
    (savedLocations: SavedLocationRecord[]) => {
      const savedAoi = savedLocations.find((loc) => loc.location_type === "aoi");
      if (!savedAoi) return false;

      const nextPrimary = savedLocationToFocusArea(savedAoi, "primary");
      if (!nextPrimary) return false;

      const savedSubs = savedLocations.filter((loc) => loc.location_type === "sub_area" && loc.parent_id === savedAoi.id);
      const nextSubAreas: FocusArea[] = [];
      const nextSavedSubAreaIds: Record<number, number> = {};
      savedSubs.forEach((loc, index) => {
        const area = savedLocationToFocusArea(loc, "sub");
        if (!area) return;
        nextSubAreas.push(area);
        nextSavedSubAreaIds[index] = loc.id;
      });

      const currentPrimary = primaryFocusAreaRef.current;
      const primaryChanged =
        !currentPrimary ||
        currentPrimary.ring.length !== nextPrimary.ring.length ||
        currentPrimary.ring.some((pt, i) => pt[0] !== nextPrimary.ring[i][0] || pt[1] !== nextPrimary.ring[i][1]);

      setSavedAoiId(savedAoi.id);
      setSavedSubAreaIds(nextSavedSubAreaIds);
      setPrimaryFocusArea(nextPrimary);
      setSubFocusAreas(nextSubAreas);
      setActiveSubAreaIndex(null);
      setSelectedSubAreaIndex(null);
      setFocusError(null);
      setExplorePhase("locked-primary");
      if (primaryChanged) requestAnimationFrame(() => applyLockedFocusToMap(nextPrimary));
      return true;
    },
    [applyLockedFocusToMap, primaryFocusAreaRef],
  );

  const loadSavedExploreAreas = useCallback(async () => {
    if (onAoiSavedRef.current) {
      startPrimaryDrawingMode();
      return;
    }
    try {
      const raw = sessionStorage.getItem(EXPLORE_CACHE_KEY);
      if (raw) applyExploreLocations(JSON.parse(raw) as SavedLocationRecord[]);
    } catch {}

    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/`, {
        method: "GET",
      });

      if (!response.ok) {
        const text = await response.text();
        console.error("Failed to load saved explore areas:", response.status, text);
        return;
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.saved_locations)) return;

      const savedLocations = data.saved_locations as SavedLocationRecord[];
      try { sessionStorage.setItem(EXPLORE_CACHE_KEY, JSON.stringify(savedLocations)); } catch {}

      const savedAoi = savedLocations.find((loc) => loc.location_type === "aoi");
      if (!savedAoi) {
        setSavedAoiId(null);
        setSavedSubAreaIds({});
        setPrimaryFocusArea(null);
        setSubFocusAreas([]);
        setActiveSubAreaIndex(null);
        setSelectedSubAreaIndex(null);

        startPrimaryDrawingMode();
        return;
      }

      applyExploreLocations(savedLocations);
    } catch (error) {
      console.error("Error loading saved explore areas:", error);
    }
  }, [applyExploreLocations, startPrimaryDrawingMode]);

  const restoreFocusAreaToTerradraw = useCallback(
    (area: FocusArea) => {
      const di = drawControlRef.current?.getTerraDrawInstance?.();
      if (!di) return false;

      clearTerradrawSelection();

      const feature: TerraDrawFeature = {
        id: crypto.randomUUID(),
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [ensureClosedRing(area.ring)],
        },
        properties: {
          mode: "rectangle",
          selected: true,
        },
      };

      try {
        di.addFeatures?.([feature]);
        rectIdRef.current = feature.id;
        di.setMode?.("select");
        di.selectFeature?.(feature.id);
        return true;
      } catch {
        setFocusError("Unable to restore the previous area. Draw a new rectangle instead.");
        return false;
      }
    },
    [clearTerradrawSelection],
  );

  const beginPrimaryFocusDrawing = useCallback(() => {
    const map = mapRef.current;
    if (map) restoreDefaultExploreCamera(map);

    clearTerradrawSelection();
    setFocusError(null);
    setPrimaryFocusArea(null);
    setSubFocusAreas([]);
    setActiveSubAreaIndex(null);
    setSelectedSubAreaIndex(null);
    setExplorePhase("drawing-primary");

    const di = drawControlRef.current?.getTerraDrawInstance?.();
    di?.setMode?.("rectangle");
  }, [clearTerradrawSelection, restoreDefaultExploreCamera]);

  const beginSubFocusDrawing = useCallback(() => {
    const primary = primaryFocusAreaRef.current;
    if (!primary) return;

    const map = mapRef.current;
    if (map) {
      map.fitBounds(bboxToBoundsLike(primary.bbox), {
        padding: 40,
        duration: 500,
      });
    }

    clearTerradrawSelection();
    setFocusError(null);
    setActiveSubAreaIndex(null);
    setSelectedSubAreaIndex(null);
    setExplorePhase("drawing-sub");

    const di = drawControlRef.current?.getTerraDrawInstance?.();
    di?.setMode?.("rectangle");
  }, [applyLockedFocusToMap, clearTerradrawSelection, primaryFocusAreaRef]);

  const handleEditAoi = useCallback(() => {
    const currentPrimaryArea = primaryFocusAreaRef.current;
    const map = mapRef.current;
    if (!map) return;

    setFocusError(null);
    clearTerradrawSelection();
    setActiveSubAreaIndex(null);
    setSelectedSubAreaIndex(null);
    setExplorePhase("drawing-primary");
    restoreDefaultExploreCamera(map);

    const di = drawControlRef.current?.getTerraDrawInstance?.();

    if (!currentPrimaryArea) {
      try {
        di?.setMode?.("rectangle");
      } catch {}
      return;
    }

    const restored = restoreFocusAreaToTerradraw(currentPrimaryArea);
    if (!restored) {
      try {
        di?.setMode?.("rectangle");
      } catch {}
    }
  }, [clearTerradrawSelection, primaryFocusAreaRef, restoreDefaultExploreCamera, restoreFocusAreaToTerradraw]);

  const handleEditSubArea = useCallback(
    (index: number) => {
      const parent = primaryFocusAreaRef.current;
      const sub = subFocusAreasRef.current[index];
      if (!parent || !sub) return;

      const map = mapRef.current;
      if (map) applyLockedFocusToMap(parent);

      setFocusError(null);
      clearTerradrawSelection();
      setActiveSubAreaIndex(index);
      setSelectedSubAreaIndex(index);
      setExplorePhase("drawing-sub");

      const restored = restoreFocusAreaToTerradraw(sub);
      if (!restored) {
        const di = drawControlRef.current?.getTerraDrawInstance?.();
        try {
          di?.setMode?.("rectangle");
        } catch {}
      }
    },
    [applyLockedFocusToMap, clearTerradrawSelection, primaryFocusAreaRef, restoreFocusAreaToTerradraw, subFocusAreasRef],
  );

  const handleConfirmAoi = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    const di = drawControlRef.current?.getTerraDrawInstance?.();
    if (!di) {
      setFocusError("Drawing tool is not ready.");
      return;
    }

    const snapshot = (di.getSnapshot?.() ?? []) as TerraDrawFeature[];
    const polygons = snapshot.filter((f) => f?.geometry?.type === "Polygon");

    if (polygons.length === 0) {
      setFocusError("Draw a rectangle first.");
      return;
    }

    const rect =
      rectIdRef.current != null
        ? (polygons.find((f) => String(f.id) === String(rectIdRef.current)) ?? polygons[polygons.length - 1])
        : polygons[polygons.length - 1];

    const ring = rect.geometry?.coordinates?.[0] as [number, number][] | undefined;

    if (!ring || ring.length < 4) {
      setFocusError("The selected area is invalid.");
      return;
    }

    const bbox = rectToBoundingBox(ring);
    const parentArea = primaryFocusAreaRef.current;
    const isSubArea = explorePhaseRef.current === "drawing-sub" && !!parentArea;
    const editingIndex = activeSubAreaIndexRef.current;

    if (isSubArea && parentArea && !bboxContains(parentArea.bbox, bbox)) {
      setFocusError("Sub-area must stay inside the primary AOI.");
      return;
    }

    const paddedBbox = expandBbox(bbox, isSubArea ? 0.04 : 0.08);

    const fallbackLabel = isSubArea
      ? editingIndex != null
        ? (subFocusAreasRef.current[editingIndex]?.label ?? `Sub-area ${editingIndex + 1}`)
        : `Sub-area ${subFocusAreasRef.current.length + 1}`
      : (primaryFocusAreaRef.current?.label ?? "Focused Area");

    const label = await reverseGeocodeAreaName(bbox, fallbackLabel);

    const nextArea: FocusArea = {
      kind: isSubArea ? "sub" : "primary",
      label,
      ring,
      bbox,
      paddedBbox,
      minZoom:
        map.cameraForBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 40 },
        )?.zoom ?? 14,
    };

    setFocusError(null);

    try {
      if (isSubArea && parentArea) {
        if (editingIndex != null) {
          const existingSavedSubAreaId = savedSubAreaIds[editingIndex];

          if (existingSavedSubAreaId) {
            await updateSavedArea({
              id: existingSavedSubAreaId,
              name: label,
              coords: ring,
              parentId: savedAoiId,
            });
          } else {
            const savedSubArea = await createSavedArea({
              name: label,
              coords: ring,
              locationType: "sub_area",
              parentId: savedAoiId,
            });

            setSavedSubAreaIds((prev) => ({
              ...prev,
              [editingIndex]: savedSubArea.id,
            }));
          }

          setSubFocusAreas((prev) => prev.map((area, index) => (index === editingIndex ? nextArea : area)));
          setSelectedSubAreaIndex(editingIndex);
        } else {
          const savedSubArea = await createSavedArea({
            name: label,
            coords: ring,
            locationType: "sub_area",
            parentId: savedAoiId,
          });

          const nextIndex = subFocusAreasRef.current.length;

          setSubFocusAreas((prev) => [...prev, nextArea]);
          setSavedSubAreaIds((prev) => ({
            ...prev,
            [nextIndex]: savedSubArea.id,
          }));
          setSelectedSubAreaIndex(nextIndex);
        }

        setActiveSubAreaIndex(null);
        setExplorePhase("locked-primary");
        applyLockedFocusToMap(parentArea);
        di.setMode?.("select");
        return;
      }

      if (onAoiSavedRef.current) {
        await createSavedArea({ name: label, coords: ring, locationType: "aoi" });
        clearTerradrawSelection();
        setFocusError(null);
        di.setMode?.("select");
        onAoiSavedRef.current();
        return;
      }

      if (savedAoiId) {
        await updateSavedArea({
          id: savedAoiId,
          name: label,
          coords: ring,
        });
      } else {
        const savedAoi = await createSavedArea({
          name: label,
          coords: ring,
          locationType: "aoi",
        });

        setSavedAoiId(savedAoi.id);
      }

      setPrimaryFocusArea(nextArea);
      setActiveSubAreaIndex(null);
      setSelectedSubAreaIndex(null);
      setSubFocusAreas((prev) => prev.filter((sub) => bboxContains(nextArea.bbox, sub.bbox)));
      setExplorePhase("locked-primary");
      applyLockedFocusToMap(nextArea);

      di.setMode?.("select");
    } catch (error) {
      console.error("Failed to save AOI/sub-area:", error);
      setFocusError("Failed to save area. Please try again.");
    }
  }, [
    activeSubAreaIndexRef,
    applyLockedFocusToMap,
    explorePhaseRef,
    primaryFocusAreaRef,
    reverseGeocodeAreaName,
    savedAoiId,
    savedSubAreaIds,
    subFocusAreasRef,
    clearTerradrawSelection,
    createSavedArea,
    updateSavedArea,
  ]);

  const fitToFocusArea = useCallback((area: FocusArea) => {
    const map = mapRef.current;
    if (!map) return;

    map.fitBounds(
      [
        [area.bbox[0], area.bbox[1]],
        [area.bbox[2], area.bbox[3]],
      ],
      { padding: 40, duration: 700 },
    );
  }, []);

  const deleteSelectedSubArea = useCallback(async () => {
    const index = selectedSubAreaIndexRef.current;
    if (index == null) return;

    const savedSubAreaId = savedSubAreaIds[index];

    try {
      if (savedSubAreaId) {
        await deleteSavedArea(savedSubAreaId);
      }

      setSubFocusAreas((prev) => prev.filter((_, i) => i !== index));

      setSavedSubAreaIds((prev) => {
        const next: Record<number, number> = {};
        Object.entries(prev).forEach(([key, value]) => {
          const numericKey = Number(key);
          if (numericKey < index) next[numericKey] = value;
          if (numericKey > index) next[numericKey - 1] = value;
        });
        return next;
      });

      setSelectedSubAreaIndex(null);
      setActiveSubAreaIndex(null);
      setFocusError(null);

      const primary = primaryFocusAreaRef.current;
      if (primary) {
        setExplorePhase("locked-primary");
        clearTerradrawSelection();
        applyLockedFocusToMap(primary);

        const di = drawControlRef.current?.getTerraDrawInstance?.();
        try {
          di?.setMode?.("select");
        } catch {

        }
      }
    } catch (error) {
      console.error("Failed to delete sub-area:", error);
      setFocusError("Failed to delete sub-area.");
    }
  }, [applyLockedFocusToMap, clearTerradrawSelection, deleteSavedArea, primaryFocusAreaRef, selectedSubAreaIndexRef, savedSubAreaIds]);

  const restartPrimaryAoiDrawing = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    clearTerradrawSelection();
    setFocusError(null);
    setPrimaryFocusArea(null);
    setSubFocusAreas([]);
    setSavedAoiId(null);
    setSavedSubAreaIds({});
    setActiveSubAreaIndex(null);
    setSelectedSubAreaIndex(null);

    restoreDefaultExploreCamera(map);
    setExplorePhase("drawing-primary");

    const tryEnableRectangle = () => {
      try {
        const di = drawControlRef.current?.getTerraDrawInstance?.();
        if (!di) return false;
        di.setMode?.("rectangle");
        return true;
      } catch {
        return false;
      }
    };

    if (tryEnableRectangle()) return;

    requestAnimationFrame(() => {
      if (tryEnableRectangle()) return;

      setTimeout(() => {
        tryEnableRectangle();
      }, 0);
    });
  }, [clearTerradrawSelection, restoreDefaultExploreCamera]);

  const deletePrimaryFocusArea = useCallback(async () => {
    try {
      if (savedAoiId) {
        await deleteSavedArea(savedAoiId);
      }

      restartPrimaryAoiDrawing();
    } catch (error) {
      console.error("Failed to delete AOI:", error);
      setFocusError("Failed to delete AOI.");
    }
  }, [deleteSavedArea, restartPrimaryAoiDrawing, savedAoiId]);

  const renderPolygonLayers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const safeRemoveLayer = (id: string) => {
      if (map.getLayer(id)) map.removeLayer(id);
    };

    const safeRemoveSource = (id: string) => {
      if (map.getSource(id)) map.removeSource(id);
    };

    safeRemoveLayer("polygon-guide-fill");
    safeRemoveLayer("polygon-guide-closing");
    safeRemoveLayer("polygon-guide");
    safeRemoveSource("polygon-guide");

    const polygonFeatures = completedPolygonsRef.current.map((p, idx) => ({
      type: "Feature" as const,
      properties: {
        polygonIndex: idx,
        cameraId: p.cameraId ?? null,
        occurrences: p.occurrences ?? 0,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [ensureClosedRing(p.points)],
      },
    }));

    const pointFeatures: any[] = [];
    polygonPointsRef.current.forEach((pt, i) => {
      pointFeatures.push({
        type: "Feature",
        properties: {
          index: i,
          isCompleted: false,
          isFirst: i === 0,
          canClose: i === 0 && polygonPointsRef.current.length >= 3,
        },
        geometry: { type: "Point", coordinates: pt },
      });
    });
    completedPolygonsRef.current.forEach((p, polygonIndex) => {
      p.points.forEach((pt, i) => {
        pointFeatures.push({
          type: "Feature",
          properties: { index: i, polygonIndex, isCompleted: true },
          geometry: { type: "Point", coordinates: pt },
        });
      });
    });

    const existingPolygonSrc = map.getSource("polygons") as maplibregl.GeoJSONSource | undefined;
    const existingPointSrc = map.getSource("polygon-points") as maplibregl.GeoJSONSource | undefined;
    if (existingPolygonSrc && existingPointSrc) {
      existingPolygonSrc.setData({ type: "FeatureCollection", features: polygonFeatures } as any);
      existingPointSrc.setData({ type: "FeatureCollection", features: pointFeatures } as any);
      return;
    }

    safeRemoveLayer("polygon-fill");
    safeRemoveLayer("polygon-line");
    safeRemoveSource("polygons");
    safeRemoveLayer("polygon-points");
    safeRemoveLayer("polygon-points-clickable");
    safeRemoveSource("polygon-points");

    map.addSource("polygons", {
      type: "geojson",
      data: { type: "FeatureCollection", features: polygonFeatures } as any,
    });

    map.addLayer({
      id: "polygon-fill",
      type: "fill",
      source: "polygons",
      paint: {
        "fill-color": [
          "interpolate", ["linear"], ["get", "occurrences"],
          0, "#1d1f3f", 1, "#2a6b4a", 5, "#f5c518", 15, "#e85d04", 30, "#9b1c1c",
        ] as any,
        "fill-opacity": 0.30,
      },
    });

    map.addLayer({
      id: "polygon-line",
      type: "line",
      source: "polygons",
      paint: {
        "line-color": [
          "interpolate", ["linear"], ["get", "occurrences"],
          0, "#1d1f3f", 1, "#2a6b4a", 5, "#f5c518", 15, "#e85d04", 30, "#9b1c1c",
        ] as any,
        "line-width": 2,
      },
    });

    map.addSource("polygon-points", {
      type: "geojson",
      data: { type: "FeatureCollection", features: pointFeatures } as any,
    });

    map.addLayer({
      id: "polygon-points",
      type: "circle",
      source: "polygon-points",
      paint: {
        "circle-radius": ["case", ["==", ["get", "canClose"], true], 8, ["==", ["get", "isFirst"], true], 7, 5],
        "circle-color": ["case", ["==", ["get", "canClose"], true], "#4CAF50", ["==", ["get", "isCompleted"], false], "#1d1f3f", "#5c6bc0"],
        "circle-stroke-width": ["case", ["==", ["get", "canClose"], true], 3, 2],
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "polygon-points-clickable",
      type: "circle",
      source: "polygon-points",
      paint: { "circle-radius": 12, "circle-opacity": 0 },
    });
  }, [completedPolygonsRef, polygonPointsRef]);

  const clearGuideline = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("polygon-guide-fill")) map.removeLayer("polygon-guide-fill");
    if (map.getLayer("polygon-guide-closing")) map.removeLayer("polygon-guide-closing");
    if (map.getLayer("polygon-guide")) map.removeLayer("polygon-guide");
    if (map.getSource("polygon-guide")) map.removeSource("polygon-guide");
  }, []);

  const renderGuideline = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      const map = mapRef.current;
      if (!map) return;

      const pts = polygonPointsRef.current;
      if (toolModeRef.current !== "addPoint" || pts.length === 0) {
        clearGuideline();
        return;
      }

      const cursor: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      const features: any[] = [];

      features.push({
        type: "Feature",
        properties: { kind: "main" },
        geometry: {
          type: "LineString",
          coordinates: [...pts, cursor],
        },
      });

      if (pts.length >= 3) {
        features.push({
          type: "Feature",
          properties: { kind: "closing" },
          geometry: {
            type: "LineString",
            coordinates: [cursor, pts[0]],
          },
        });
      }

      if (pts.length >= 2) {
        const ring = [...pts, cursor, pts[0]];
        features.push({
          type: "Feature",
          properties: { kind: "preview-fill" },
          geometry: {
            type: "Polygon",
            coordinates: [ring],
          },
        });
      }

      const data = { type: "FeatureCollection", features };

      if (!map.getSource("polygon-guide")) {
        map.addSource("polygon-guide", { type: "geojson", data: data as any });
        map.addLayer({
          id: "polygon-guide-fill",
          type: "fill",
          source: "polygon-guide",
          filter: ["==", ["get", "kind"], "preview-fill"],
          paint: {
            "fill-color": "#1d1f3f",
            "fill-opacity": 0.1,
          },
        });
        map.addLayer({
          id: "polygon-guide",
          type: "line",
          source: "polygon-guide",
          filter: ["==", ["get", "kind"], "main"],
          paint: {
            "line-color": "#1d1f3f",
            "line-width": 2.5,
            "line-dasharray": [3, 2],
          },
        });
        map.addLayer({
          id: "polygon-guide-closing",
          type: "line",
          source: "polygon-guide",
          filter: ["==", ["get", "kind"], "closing"],
          paint: {
            "line-color": "#1d1f3f",
            "line-width": 2,
            "line-dasharray": [2, 3],
            "line-opacity": 0.45,
          },
        });
      } else {
        (map.getSource("polygon-guide") as maplibregl.GeoJSONSource).setData(data as any);
      }
    },
    [clearGuideline, polygonPointsRef, toolModeRef],
  );

  useEffect(() => {
    if (mode !== "explore") {
      hasLoadedExploreAreasRef.current = false;
      return;
    }

    if (hasLoadedExploreAreasRef.current) return;
    hasLoadedExploreAreasRef.current = true;

    loadSavedExploreAreas();
  }, [mode, loadSavedExploreAreas]);

  useEffect(() => {
    if (mode !== "explore") return;
    if (!onAoiSavedRef.current) return;
    if (explorePhase === "idle") startPrimaryDrawingMode();
  }, [explorePhase, mode, startPrimaryDrawingMode]);

  useEffect(() => {
    if (toolMode !== "addPoint") clearGuideline();
  }, [clearGuideline, toolMode]);

  // AOI rectangle drawing — independent of explore mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    if (isDrawingAOI) {
      if (aoiDrawControlRef.current) return;

      const drawControl = new MaplibreTerradrawControl({
        modes: ["select", "rectangle"],
        open: false,
        showDeleteConfirmation: false,
      });
      map.addControl(drawControl, "bottom-right");
      aoiDrawControlRef.current = drawControl;

      const di = drawControl.getTerraDrawInstance();
      if (di) {
        try { di.setMode("rectangle"); } catch {}

        const onFinish = () => {
          try {
            const snapshot = (di.getSnapshot?.() ?? []) as TerraDrawFeature[];
            const polys = snapshot.filter((f) => f?.geometry?.type === "Polygon");
            if (polys.length === 0) return;
            const ring = polys[polys.length - 1].geometry.coordinates[0] as [number, number][];

            // Reject degenerate (near-zero area) polygons using the Shoelace formula.
            // Threshold: ~1e-8 deg² ≈ 100 m² — catches accidental double-clicks.
            let area = 0;
            for (let i = 0; i < ring.length; i++) {
              const [x1, y1] = ring[i];
              const [x2, y2] = ring[(i + 1) % ring.length];
              area += x1 * y2 - x2 * y1;
            }
            if (Math.abs(area / 2) < 1e-8) {
              try { di.clear?.(); di.setMode("rectangle"); } catch {}
              return;
            }

            // Stamp the finish time BEFORE invoking the callback so the AOI
            // and sub-area click handlers can ignore the same-click event.
            lastDrawingFinishTimeRef.current = Date.now();

            const clearDrawing = () => {
              try { di.clear?.(); di.setMode("rectangle"); } catch {}
            };
            onAoiDrawnRef.current?.(ring, clearDrawing);
          } catch (err) {
            console.warn("AOI drawing error (likely degenerate polygon):", err);
            try { di.clear?.(); di.setMode("rectangle"); } catch {}
          }
        };

        try { di.on("finish", onFinish); } catch {}
      }
    } else {
      if (aoiDrawControlRef.current) {
        try { map.removeControl(aoiDrawControlRef.current); } catch {}
        aoiDrawControlRef.current = null;
      }
    }
  }, [isDrawingAOI]);

  // Render saved AOIs as blue rectangle overlays
  const latestAoiItemsRef  = useRef(aoiItems ?? []);
  latestAoiItemsRef.current = aoiItems ?? [];           
  const aoiLayersReadyRef   = useRef(false);
  const aoiCleanupRef       = useRef<(() => void) | null>(null);
  const aoiPendingSetupRef  = useRef(false);           

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE = "aoi-polygons";
    const FILL   = "aoi-fill";
    const LINE   = "aoi-line";

    const toFC = (items: NonNullable<typeof aoiItems>) => ({
      type: "FeatureCollection" as const,
      features: items.map((item) => ({
        type: "Feature" as const,
        id: item.id,
        geometry: { type: "Polygon" as const, coordinates: [item.ring] },
        properties: { id: item.id },
      })),
    });

    // Fast path — layers already exist: just swap data, no rebuild
    if (aoiLayersReadyRef.current && map.getSource(SOURCE)) {
      (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(toFC(aoiItems ?? []) as any);
      return;
    }

    // First-time setup
    const setup = () => {
      if (map.getLayer(FILL))    map.removeLayer(FILL);
      if (map.getLayer(LINE))    map.removeLayer(LINE);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);

      map.addSource(SOURCE, { type: "geojson", data: toFC(latestAoiItemsRef.current) as any });
      map.addLayer({
        id: FILL, type: "fill", source: SOURCE,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hovered"], false], 0.28, 0.12],
        },
      });
      map.addLayer({
        id: LINE, type: "line", source: SOURCE,
        paint: {
          "line-color": "#2563eb",
          "line-width":  ["case", ["boolean", ["feature-state", "hovered"], false], 3,   2],
          "line-opacity": ["case", ["boolean", ["feature-state", "hovered"], false], 1, 0.85],
        },
      });

      const clickHandler  = (e: any) => {
        if (isDrawingAOIRef.current) return; // ignore clicks while drawing a new AOI
        if (Date.now() - lastDrawingFinishTimeRef.current < 500) return; // ignore clicks immediately after finishing a draw
        const id = e.features?.[0]?.properties?.id;
        if (id != null) onAoiClickRef.current?.(Number(id));
      };
      const enterHandler = () => { map.getCanvas().style.cursor = "pointer"; };
      const leaveHandler = () => { map.getCanvas().style.cursor = ""; };

      map.on("click",      FILL, clickHandler);
      map.on("mouseenter", FILL, enterHandler);
      map.on("mouseleave", FILL, leaveHandler);

      aoiLayersReadyRef.current  = true;
      aoiPendingSetupRef.current = false;
      aoiCleanupRef.current = () => {
        try {
          map.off("click",      FILL, clickHandler);
          map.off("mouseenter", FILL, enterHandler);
          map.off("mouseleave", FILL, leaveHandler);
          if (map.getLayer(FILL))    map.removeLayer(FILL);
          if (map.getLayer(LINE))    map.removeLayer(LINE);
          if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        } catch {}
        aoiLayersReadyRef.current = false;
      };
    };

    if (mapLoadedRef.current) {
      setup();
    } else if (!aoiPendingSetupRef.current) {
      aoiPendingSetupRef.current = true;
      map.once("load", setup);
    }
  }, [aoiItems]);

  useEffect(() => {
    return () => { aoiCleanupRef.current?.(); aoiCleanupRef.current = null; };
  }, []);

  // Hover highlight via feature-state
  const prevHoveredAoiIdRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const SOURCE = "aoi-polygons";
    if (!map.getSource(SOURCE)) return;

    const prev = prevHoveredAoiIdRef.current;
    if (prev != null) {
      try { map.setFeatureState({ source: SOURCE, id: prev }, { hovered: false }); } catch {}
    }
    if (hoveredAoiId != null) {
      try { map.setFeatureState({ source: SOURCE, id: hoveredAoiId }, { hovered: true }); } catch {}
    }
    prevHoveredAoiIdRef.current = hoveredAoiId ?? null;
  }, [hoveredAoiId]);

  // Sub-area polygons
  const latestSubAreaItemsRef  = useRef(subAreaItems ?? []);
  latestSubAreaItemsRef.current = subAreaItems ?? [];
  const subAreaLayersReadyRef   = useRef(false);
  const subAreaCleanupRef       = useRef<(() => void) | null>(null);
  const subAreaPendingSetupRef  = useRef(false);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const SOURCE = "sub-area-polygons";
    const FILL   = "sub-area-fill";
    const LINE   = "sub-area-line";

    const toFC = (items: NonNullable<typeof subAreaItems>) => ({
      type: "FeatureCollection" as const,
      features: items.map((item) => ({
        type: "Feature" as const,
        id: item.id,
        geometry: { type: "Polygon" as const, coordinates: [item.ring] },
        properties: { id: item.id },
      })),
    });

    // Fast path — layers exist: just swap data
    if (subAreaLayersReadyRef.current && map.getSource(SOURCE)) {
      (map.getSource(SOURCE) as maplibregl.GeoJSONSource).setData(toFC(subAreaItems ?? []) as any);
      return;
    }

    // Nothing to render yet
    if (!subAreaItems || subAreaItems.length === 0) return;

    const setup = () => {
      if (map.getLayer(FILL))    map.removeLayer(FILL);
      if (map.getLayer(LINE))    map.removeLayer(LINE);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);

      map.addSource(SOURCE, { type: "geojson", data: toFC(latestSubAreaItemsRef.current) as any });
      map.addLayer({
        id: FILL, type: "fill", source: SOURCE,
        paint: {
          "fill-color": "#ea580c",
          "fill-opacity": ["case", ["boolean", ["feature-state", "hovered"], false], 0.38, 0.15],
        },
      });
      map.addLayer({
        id: LINE, type: "line", source: SOURCE,
        paint: {
          "line-color": "#ea580c",
          "line-width":  ["case", ["boolean", ["feature-state", "hovered"], false], 3, 2],
          "line-opacity": ["case", ["boolean", ["feature-state", "hovered"], false], 1, 0.85],
        },
      });

      const clickHandler = (e: any) => {
        if (isDrawingAOIRef.current) return;
        if (Date.now() - lastDrawingFinishTimeRef.current < 500) return; 
        const id = e.features?.[0]?.properties?.id;
        if (id != null) onSubAreaClickRef.current?.(Number(id));
      };
      const enterHandler = (e: any) => {
        map.getCanvas().style.cursor = "pointer";
        const id = e.features?.[0]?.properties?.id;
        if (id != null) onSubAreaHoverRef.current?.(Number(id));
      };
      const leaveHandler = () => {
        map.getCanvas().style.cursor = "";
        onSubAreaHoverRef.current?.(null);
      };

      map.on("click",      FILL, clickHandler);
      map.on("mouseenter", FILL, enterHandler);
      map.on("mouseleave", FILL, leaveHandler);

      subAreaLayersReadyRef.current  = true;
      subAreaPendingSetupRef.current = false;
      subAreaCleanupRef.current = () => {
        try {
          map.off("click",      FILL, clickHandler);
          map.off("mouseenter", FILL, enterHandler);
          map.off("mouseleave", FILL, leaveHandler);
          if (map.getLayer(FILL))    map.removeLayer(FILL);
          if (map.getLayer(LINE))    map.removeLayer(LINE);
          if (map.getSource(SOURCE)) map.removeSource(SOURCE);
        } catch {}
        subAreaLayersReadyRef.current = false;
      };
    };

    if (mapLoadedRef.current) {
      setup();
    } else if (!subAreaPendingSetupRef.current) {
      subAreaPendingSetupRef.current = true;
      map.once("load", setup);
    }
  }, [subAreaItems]);

  useEffect(() => {
    return () => { subAreaCleanupRef.current?.(); subAreaCleanupRef.current = null; };
  }, []);

  // Hover highlight for sub-area polygons (feature-state)
  const prevHoveredSubAreaIdRef = useRef<number | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const SOURCE = "sub-area-polygons";
    if (!map.getSource(SOURCE)) return;

    const prev = prevHoveredSubAreaIdRef.current;
    if (prev != null) {
      try { map.setFeatureState({ source: SOURCE, id: prev }, { hovered: false }); } catch {}
    }
    if (hoveredSubAreaId != null) {
      try { map.setFeatureState({ source: SOURCE, id: hoveredSubAreaId }, { hovered: true }); } catch {}
    }
    prevHoveredSubAreaIdRef.current = hoveredSubAreaId ?? null;
  }, [hoveredSubAreaId]);

  // ── Max-bounds lock (restricts panning when an AOI is entered) ────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    try { map.setMaxBounds(mapMaxBounds ?? null); } catch {}
  }, [mapMaxBounds]);

  const cancelFocusDrawing = useCallback(() => {
    clearTerradrawSelection();
    setFocusError(null);

    const primary = primaryFocusAreaRef.current;
    const editingIndex = activeSubAreaIndexRef.current;
    const subAreas = subFocusAreasRef.current;

    if (explorePhaseRef.current === "drawing-primary") {
      if (primary) {
        setExplorePhase("locked-primary");
        applyLockedFocusToMap(primary);
      } else {
        setExplorePhase("idle");
        const map = mapRef.current;
        if (map) restoreDefaultExploreCamera(map);
      }
    } else if (explorePhaseRef.current === "drawing-sub") {
      setActiveSubAreaIndex(null);

      if (editingIndex != null && primary) {
        setSelectedSubAreaIndex(editingIndex);
        setExplorePhase("locked-primary");
        applyLockedFocusToMap(primary);
        return;
      }

      if (subAreas.length > 0 || primary) {
        setExplorePhase("locked-primary");
        if (primary) applyLockedFocusToMap(primary);
      } else {
        setExplorePhase("idle");
      }
    }
  }, [
    clearTerradrawSelection,
    applyLockedFocusToMap,
    primaryFocusAreaRef,
    activeSubAreaIndexRef,
    subFocusAreasRef,
    explorePhaseRef,
    restoreDefaultExploreCamera,
  ]);

  // CONFIGURATION MODE

  const removeCamera = useCallback(async (cameraId: number | string) => {
    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) return;

      const cam = camerasRef.current.find((c) => String(c.id) === String(cameraId));
      cam?.marker?.remove();

      camerasRef.current = camerasRef.current.filter((c) => String(c.id) !== String(cameraId));
      setCameras((prev) => prev.filter((c) => String(c.id) !== String(cameraId)));
    } catch {}
  }, []);

  const savePolygonToCamera = useCallback(async (cameraId: number | string, points: [number, number][]) => {
    const res = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/polygon/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ polygon: points }),
    });

    return res.ok;
  }, []);

  const addCameraFromData = useCallback(
    (cameraLat: number, cameraLng: number, id: number | string) => {
      const map = mapRef.current;
      if (!map) return;

      const el = document.createElement("div");
      el.className = "camera-marker";
      el.style.cursor = "pointer";
      el.innerHTML = `
        <svg width="32" height="32" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
                stroke="#fff"
                stroke-width="0.5"/>
        </svg>
      `;
      el.style.color = "#999";
      el.style.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.3))";

      const isSelected = selectedCameraId != null && String(id) === String(selectedCameraId);
      el.style.color = isSelected ? "#161b4c" : "#999";

      const marker = new maplibregl.Marker({
        element: el,
        draggable: false,
        anchor: "center",
      })
        .setLngLat([cameraLng, cameraLat])
        .addTo(map);

      const cameraObj: CameraMarkerEntry = {
        id,
        marker,
        lat: cameraLat,
        lng: cameraLng,
        element: el,
      };

      el.addEventListener("click", async (e) => {
        e.stopPropagation();

        if (toolModeRef.current === "removeCamera") {
          removeCamera(id);
          return;
        }

        if (toolModeRef.current === "assignCamera") {
          const polyIdx = selectedPolygonIndexRef.current;
          if (polyIdx == null) return;

          const poly = completedPolygonsRef.current[polyIdx];
          if (!poly) return;

          const ok = await savePolygonToCamera(id, poly.points);
          if (!ok) return;

          setCompletedPolygons((prev) => prev.map((p, i) => (i === polyIdx ? { ...p, cameraId: id } : p)));

          setToolMode("none");
          setShowPolygonModal(false);
          setSelectedPolygonIndex(null);
          return;
        }

        onCameraClick?.(id);
      });

      camerasRef.current = [...camerasRef.current, cameraObj];
      setCameras((prev) => [...prev, cameraObj]);
    },
    [completedPolygonsRef, onCameraClick, removeCamera, savePolygonToCamera, selectedPolygonIndexRef, toolModeRef, selectedCameraId],
  );

  const CAMERAS_CACHE_KEY = "bp_cameras_v1";

  const loadCamerasFromDatabase = useCallback(async () => {
    try {
      const raw = sessionStorage.getItem(CAMERAS_CACHE_KEY);
      if (raw) {
        const cached: Camera[] = JSON.parse(raw);
        camerasRef.current.forEach((c) => c.marker?.remove());
        camerasRef.current = [];
        setCameras([]);
        cached.forEach((cam) => addCameraFromData(cam.lat, cam.lng, cam.id));
        const cachedPolygons: CompletedPolygon[] = cached
          .filter((cam) => cam.polygon && (cam.polygon as any).length > 0)
          .map((cam) => ({
            points: cam.polygon as [number, number][],
            cameraId: cam.id,
            occurrences: cam.occurrences ?? 0,
          }));
        if (cachedPolygons.length > 0) setCompletedPolygons(cachedPolygons);
        onCamerasLoaded?.(cached);
      }
    } catch {}

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    try {
      const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });

      if (controller.signal.aborted) return;
      if (!response.ok) return;

      const data = await response.json();
      if (controller.signal.aborted) return;
      if (!data?.success || !data?.cameras) return;

      try { sessionStorage.setItem(CAMERAS_CACHE_KEY, JSON.stringify(data.cameras)); } catch {}

      camerasRef.current.forEach((c) => c.marker?.remove());
      camerasRef.current = [];
      setCameras([]);

      data.cameras.forEach((cam: Camera) => addCameraFromData(cam.lat, cam.lng, cam.id));

      const polygons: CompletedPolygon[] = data.cameras
        .filter((cam: Camera) => cam.polygon && cam.polygon.length > 0)
        .map((cam: Camera) => ({
          points: cam.polygon as [number, number][],
          cameraId: cam.id,
          occurrences: cam.occurrences ?? 0,
        }));

      setCompletedPolygons(polygons);
      onCamerasLoaded?.(data.cameras);
    } catch (err: any) {
      if (err?.name === "AbortError") return;
    }
  }, [addCameraFromData, onCamerasLoaded]);

  const addCamera = useCallback(
    async (cameraLat: number, cameraLng: number) => {
      try {
        const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: cameraLat, lng: cameraLng }),
        });

        if (!response.ok) return;

        const data = await response.json();
        if (!data?.success || !data?.camera) return;

        addCameraFromData(data.camera.lat, data.camera.lng, data.camera.id);
        onCameraAdd?.(data.camera.id, data.camera.lat, data.camera.lng, data.camera);
      } catch {}
    },
    [addCameraFromData, onCameraAdd],
  );

  const assignCameraToSavedLocation = useCallback(async (cameraId: number, savedLocationId: number) => {
    await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${cameraId}/assign-saved-location/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        saved_location_id: savedLocationId,
      }),
    });
  }, []);

  const updateVisibleCamerasTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateVisibleCameras = useCallback(() => {
    if (updateVisibleCamerasTimerRef.current) clearTimeout(updateVisibleCamerasTimerRef.current);
    updateVisibleCamerasTimerRef.current = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;
      const bounds = map.getBounds();
      const visible = camerasRef.current.filter((c) => bounds.contains([c.lng, c.lat])).map((c) => c.id);
      onVisibleCamerasChange?.(visible);
    }, 250);
  }, [onVisibleCamerasChange]);

  useEffect(() => {
    if (!mapContainer.current) return;
    if (mapRef.current) return;

    const map = createMap();
    mapRef.current = map;
    isFirstGoToRef.current = true; 
    onMapReady?.(map);

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    defaultMinZoomRef.current = map.getMinZoom();
    defaultMaxZoomRef.current = map.getMaxZoom();

    const onViewportSave = () => {
 
      if (modeRef.current === "explore") return;
      try {
        sessionStorage.setItem(
          VIEWPORT_CACHE_KEY,
          JSON.stringify({ center: map.getCenter().toArray(), zoom: map.getZoom() }),
        );
      } catch {}
    };
    map.on("moveend", onViewportSave);

    map.once("load", () => {
      mapLoadedRef.current = true;
      add3DBuildingsLayer(map);
      restoreDefaultExploreCamera(map);

      if (modeRef.current === "explore" && primaryFocusAreaRef.current) {
        const area = primaryFocusAreaRef.current;
        const fittedZoom = map.getZoom();
        map.setMaxBounds(bboxToBoundsLike(area.paddedBbox));
        map.setMinZoom(fittedZoom);
        map.setMaxZoom(Math.max(fittedZoom + 6, 18));
        disableRotationInteractions(map);
      }
    });

    return () => {
      openDashboardPopupRef.current?.remove();
      openDashboardPopupRef.current = null;

      const reg = dashboardRegistryRef.current;
      for (const entry of reg.values()) cleanupDashEntry(entry);
      reg.clear();

      camerasRef.current.forEach((c) => c.marker?.remove());
      camerasRef.current = [];
      setCameras([]);

      try {
        map.remove();
      } catch {}

      mapRef.current = null;
      mapLoadedRef.current = false;
      editControlRef.current = null;
      drawControlRef.current = null;
      geocoderControlRef.current = null;
      aoiDrawControlRef.current = null;
    };
  }, [add3DBuildingsLayer, createMap, onMapReady, restoreDefaultExploreCamera]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if ( /* mode === "map" || */ mode === "explore" || showGeocoder) {
      if (!geocoderControlRef.current) {
        const geocoder = new MaplibreGeocoder(geocoderApi, {
          maplibregl,
          flyTo: true,
          marker: false,
          showResultMarkers: false,
          showResultsWhileTyping: true,
          countries: "ph",
        });
        map.addControl(geocoder, "top-left");
        geocoderControlRef.current = geocoder;
      }
    } else if (geocoderControlRef.current) {
      map.removeControl(geocoderControlRef.current);
      geocoderControlRef.current = null;
    }

    if (mode === "explore") {
      if (!drawControlRef.current) {
        const drawControl = new MaplibreTerradrawControl({
          modes: ["select", "rectangle"],
          open: true,
          showDeleteConfirmation: false,
        });

        map.addControl(drawControl, "bottom-right");
        drawControlRef.current = drawControl;

        const di = drawControl.getTerraDrawInstance();

        if (di) {
          const syncTerradrawState = () => {
            if (enforcingRef.current) return;
            enforcingRef.current = true;

            try {
              const snapshot = (di.getSnapshot?.() ?? []) as TerraDrawFeature[];
              const polys = snapshot.filter((f) => f?.geometry?.type === "Polygon");

              if (polys.length === 0) {
                rectIdRef.current = null;
                return;
              }

              const keep = polys[polys.length - 1];
              const keepId = String(keep.id);

              for (const f of polys) {
                const id = String(f.id);
                if (id !== keepId) {
                  try {
                    di.removeFeatures([id]);
                  } catch {}
                }
              }

              rectIdRef.current = keepId;
            } finally {
              enforcingRef.current = false;
            }
          };

          syncTerradrawState();
          try { di.on("finish", syncTerradrawState); } catch {}
          try { di.on("select", syncTerradrawState); } catch {}
          try { di.on("change", syncTerradrawState); } catch {}
        }
      }
      rectIdRef.current = null;
    }

    if (mode === "map") {
      /*
      if (!editControlRef.current) {
        editControlRef.current = new ToggleEditButton((isEdit) => {
          setIsEditMode(isEdit);
          setToolMode("none");
        });
        map.addControl(editControlRef.current, "bottom-right");
      }
      
    } else {
      if (editControlRef.current) {
        map.removeControl(editControlRef.current);
        editControlRef.current = null;
      }
    */

      if (!hideEditControls) {
        if (!editControlRef.current) {
          editControlRef.current = new createToggleButtons((toolMode) => {
          setToolMode(toolMode);
          
          // if setting to add polygon, bring up the add polygon specific menu options
          if (toolMode == "addPoint") {
            polygonEditControlRef.current = new createPolygonEditButtons((onPress) => {
              // handle actions for polygon undo/discard
              console.log(polygonPointsRef)
              if (polygonPointsRef.current.length > 0) {
                if (onPress === "undo") {
                  setPolygonPoints((prev) => prev.slice(0, -1))
                } else if (onPress === "discard") {
                  setPolygonPoints([]);
                  clearGuideline();
                }
              }
            });
            map.addControl(polygonEditControlRef.current, "bottom-right");
          }

          // if moving away from it, remove them
          else if (polygonEditControlRef.current) {
            map.removeControl(polygonEditControlRef.current);
            polygonEditControlRef.current = null;
          }

        });
        console.log(editControlRef.current)
        map.addControl(editControlRef.current, "bottom-right");
      } else {
        if (editControlRef.current) {
          map.removeControl(editControlRef.current);
          editControlRef.current = null;
        }
      }
      } // end hideEditControls check

/*
                <button
                  onClick={() => }
                  className="edit-toolbar__btn edit-toolbar__btn--undo"
                  title="Undo last point"
                >
                  ↩ Undo
                </button>
                <button
                  onClick={() => {

                  }}
                  className="edit-toolbar__btn edit-toolbar__btn--clear"
                  title="Discard current polygon"
                >
                  ✕ Clear
                </button>
*/
      

      setIsEditMode(true);
      setToolMode("none");
    }

    if (mode !== "map") {
      setShowPolygonModal(false);
      setSelectedPolygonIndex(null);
      setPolygonPoints([]);
    }

    const applyLayers = () => {
      if (mode !== "heatmap") removeHeatmapLayers(map);
      if (mode === "heatmap") addHeatmapLayers(map);
    };

    if (map.isStyleLoaded()) applyLayers();
    else map.once("load", applyLayers);

    return () => { map.off("load", applyLayers); };
  }, [
    addHeatmapLayers,
    geocoderApi,
    mode,
    removeHeatmapLayers,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const isFirst = isFirstGoToRef.current;

    if (goToBounds) {
      isFirstGoToRef.current = false;
      map.fitBounds(goToBounds, {
        padding: 60,
        duration: isFirst ? 0 : 500,
        essential: true,
      });
      return;
    }

    if (!goTo) return;

    isFirstGoToRef.current = false;
    if (isFirst) {
      map.jumpTo({ center: goTo, zoom: 18 });
    } else {
      map.flyTo({ center: goTo, zoom: 18, duration: 500, essential: true });
    }
  }, [goTo, goToBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const token = process.env.NEXT_PUBLIC_MAPILLARY_TOKEN;

    const apply = () => {
      if (showMapillarySigns && token) {
        if (!map.getSource(MAPILLARY_SOURCE_ID)) {
          map.addSource(MAPILLARY_SOURCE_ID, {
            type: "vector",
            tiles: [mapillaryTileUrl(token)],
            minzoom: 14,
            maxzoom: 14,
          });
        }

        if (!map.getLayer(MAPILLARY_LAYER_ID)) {
          loadSignImages(map, token).then(() => {
            if (!map.getSource(MAPILLARY_SOURCE_ID)) return;
            if (map.getLayer(MAPILLARY_LAYER_ID)) return;

            const belowLayer = map.getLayer("focus-areas-mask") ? "focus-areas-mask" : undefined;

            map.addLayer({
              id: MAPILLARY_LAYER_ID,
              type: "symbol",
              source: MAPILLARY_SOURCE_ID,
              "source-layer": "traffic_sign",
              minzoom: 14,
              filter: buildMapillaryFilter() as any,
              layout: {
                "icon-image": buildIconImageExpression() as any,
                "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.28, 18, 0.7],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
            }, belowLayer);

            map.on("click", MAPILLARY_LAYER_ID, (e: any) => {
              const feature = e.features?.[0];
              if (!feature) return;

              const val = feature.properties?.value ?? "";
              const cls = resolveBrakePointClass(val) ?? val;

              new maplibregl.Popup({ offset: 10, closeButton: false })
                .setLngLat(e.lngLat)
                .setHTML(
                  `<div style="font-family:Montserrat,sans-serif;padding:4px 2px">
                    <strong style="font-size:13px">${cls}</strong>
                    <br/>
                    <span style="font-size:11px;color:#666">${val}</span>
                  </div>`,
                )
                .addTo(map);
            });

            map.on("mouseenter", MAPILLARY_LAYER_ID, () => {
              map.getCanvas().style.cursor = "pointer";
            });

            map.on("mouseleave", MAPILLARY_LAYER_ID, () => {
              map.getCanvas().style.cursor = "";
            });
          });
        }
      } else {
        if (map.getLayer(MAPILLARY_LAYER_ID)) map.removeLayer(MAPILLARY_LAYER_ID);
        if (map.getSource(MAPILLARY_SOURCE_ID)) map.removeSource(MAPILLARY_SOURCE_ID);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [showMapillarySigns]);

  useEffect(() => {
    if (cleanMap) return;
    if (mode !== "map" && mode !== "heatmap") return;
    loadCamerasFromDatabase();

    return () => {
      loadAbortRef.current?.abort();
    };
  }, [cleanMap, loadCamerasFromDatabase, mode]);

  useEffect(() => {
    if (cleanMap) return;
    if (mode !== "map") return;
    if (refreshTrigger > 0 && mapRef.current) loadCamerasFromDatabase();
  }, [cleanMap, loadCamerasFromDatabase, mode, refreshTrigger]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMoveEnd = () => updateVisibleCameras();
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    updateVisibleCameras();

    return () => {
      map.off("moveend", onMoveEnd);
      map.off("zoomend", onMoveEnd);
    };
  }, [updateVisibleCameras]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => renderPolygonLayers();
    if (map.isStyleLoaded()) {
      apply();
    } else {
      map.once("load", apply);
      return () => {
        map.off("load", apply);
      };
    }
  }, [completedPolygons, polygonPoints, renderPolygonLayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer("polygon-fill")) return;

    const selected = selectedCameraId != null ? String(selectedCameraId) : null;

    if (selected == null) {
      map.setPaintProperty("polygon-fill", "fill-opacity", 0.08);
      map.setPaintProperty("polygon-line", "line-opacity", 0.25);
    } else {
      map.setPaintProperty("polygon-fill", "fill-opacity", ["case", ["==", ["to-string", ["get", "cameraId"]], selected], 0.35, 0.05]);

      map.setPaintProperty("polygon-line", "line-opacity", ["case", ["==", ["to-string", ["get", "cameraId"]], selected], 1, 0.15]);
    }
  }, [completedPolygons, selectedCameraId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleMapClick = async (e: maplibregl.MapMouseEvent) => {
      const activeTool = toolModeRef.current;

      if (activeTool === "none" && isEditMode && mode === "map") {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ["polygon-fill"],
        });

        if (features.length > 0) {
          const idx = Number(features[0].properties?.polygonIndex);
          if (!Number.isNaN(idx)) {
            setSelectedPolygonIndex(idx);
            setShowPolygonModal(true);
          }
        }
        return;
      }

      if (!isEditMode && activeTool !== "none") return;

      if (activeTool === "addCamera") {
        await addCamera(e.lngLat.lat, e.lngLat.lng);
        return;
      }

      if (activeTool === "addPoint") {
        if (polygonPointsRef.current.length >= 3) {
          const hit = map.queryRenderedFeatures(e.point, {
            layers: ["polygon-points", "polygon-points-clickable"],
          });

          if (hit.length > 0) {
            const props: any = hit[0].properties ?? {};
            const idx = Number(props.index);
            const isCompleted = props.isCompleted === true || props.isCompleted === "true";

            if (!isCompleted && idx === 0) {
              const newPoly: CompletedPolygon = {
                points: [...polygonPointsRef.current],
                cameraId: null,
              };

              setCompletedPolygons((prev) => [...prev, newPoly]);
              setPolygonPoints([]);
              clearGuideline();
              setShowSuccessNotification(true);
              window.setTimeout(() => setShowSuccessNotification(false), 1500);
              return;
            }
          }
        }

        setPolygonPoints((prev) => [...prev, [e.lngLat.lng, e.lngLat.lat]]);
        return;
      }

      if (activeTool === "removePoint") {
        const hit = map.queryRenderedFeatures(e.point, {
          layers: ["polygon-points", "polygon-points-clickable"],
        });

        if (hit.length > 0) {
          const props: any = hit[0].properties ?? {};
          const idx = Number(props.index);
          const isCompleted = props.isCompleted === true || props.isCompleted === "true";

          if (!isCompleted && !Number.isNaN(idx)) {
            setPolygonPoints((prev) => prev.filter((_, i) => i !== idx));
          }
        }
      }
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (!isEditMode) return;
      if (toolModeRef.current === "addPoint") renderGuideline(e);
    };

    map.on("click", handleMapClick);
    map.on("mousemove", handleMouseMove);

    return () => {
      map.off("click", handleMapClick);
      map.off("mousemove", handleMouseMove);
    };
  }, [addCamera, clearGuideline, isEditMode, mode, renderGuideline, toolModeRef, polygonPointsRef]);

  useEffect(() => {
    const selected = selectedCameraId != null ? String(selectedCameraId) : null;

    for (const c of camerasRef.current) {
      const isSel = selected != null && String(c.id) === selected;
      c.element.style.color = isSel ? "#161b4c" : "#999";

      const svg = c.element.querySelector("svg") as SVGSVGElement | null;
      if (svg) {
        svg.style.transform = isSel ? "scale(1.08)" : "scale(1)";
        svg.style.transition = "transform 0.15s ease";
      }
    }
  }, [selectedCameraId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();
    canvas.classList.remove("map-crosshair", "map-remove");
    canvas.style.cursor = "";

    if (!isEditMode) return;

    if (toolMode === "addCamera" || toolMode === "addPoint") {
      canvas.classList.add("map-crosshair");
    }

    if (toolMode === "removeCamera" || toolMode === "removePoint") {
      canvas.classList.add("map-remove");
    }

    if (toolMode === "assignCamera") {
      canvas.style.cursor = "pointer";
    }
  }, [isEditMode, toolMode]);

  useEffect(() => {
    if (mode !== "explore") return;
    if (primaryFocusArea) return;

    if (explorePhase !== "idle" && explorePhase !== "drawing-primary") return;

    const tryStart = () => {
      try {
        const di = drawControlRef.current?.getTerraDrawInstance?.();
        if (!di) return false;

        beginPrimaryFocusDrawing();
        return true;
      } catch {
        return false;
      }
    };

    if (tryStart()) return;

    requestAnimationFrame(() => {
      tryStart();
    });
  }, [beginPrimaryFocusDrawing, explorePhase, mode, primaryFocusArea]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const sourceId = "focus-areas";
    const maskFillId = "focus-areas-mask";
    const fillId = "focus-areas-fill";
    const lineId = "focus-areas-line";
    const labelId = "focus-areas-label";

    if (mode !== "explore") {
      if (map.getLayer(labelId)) map.removeLayer(labelId);
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(fillId)) map.removeLayer(fillId);
      if (map.getLayer(maskFillId)) map.removeLayer(maskFillId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      return;
    }

    const features: GeoJSON.Feature[] = [];

    if (primaryFocusArea) {
      features.push(createFocusMask(primaryFocusArea.ring) as any);

      features.push({
        type: "Feature",
        properties: {
          kind: "primary",
          label: primaryFocusArea.label,
        },
        geometry: {
          type: "Polygon",
          coordinates: [ensureClosedRing(primaryFocusArea.ring)],
        },
      } as GeoJSON.Feature);
    }

    subFocusAreas.forEach((area, index) => {
      features.push({
        type: "Feature",
        properties: {
          kind: "sub",
          index,
          label: area.label,
          active: activeSubAreaIndex === index ? 1 : 0,
          selected: selectedSubAreaIndex === index ? 1 : 0,
        },
        geometry: {
          type: "Polygon",
          coordinates: [ensureClosedRing(area.ring)],
        },
      } as GeoJSON.Feature);
    });

    const data: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    const apply = () => {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "geojson",
          data,
        });

        const aboveLayer = map.getLayer(MAPILLARY_LAYER_ID) ? MAPILLARY_LAYER_ID : undefined;

        map.addLayer({
          id: maskFillId,
          type: "fill",
          source: sourceId,
          filter: ["==", ["get", "kind"], "mask"],
          paint: {
            "fill-color": "#000",
            "fill-opacity": 0.28,
          },
        }, aboveLayer);

        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          filter: ["!=", ["get", "kind"], "mask"],
          paint: {
            "fill-color": ["case", ["==", ["get", "kind"], "sub"], "#3b82f6", "#111827"],
            "fill-opacity": [
              "case",
              ["==", ["get", "kind"], "sub"],
              ["case", ["==", ["get", "active"], 1], 0.34, ["==", ["get", "selected"], 1], 0.32, 0.2],
              0.12,
            ],
          },
        }, aboveLayer);

        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          filter: ["!=", ["get", "kind"], "mask"],
          paint: {
            "line-color": ["case", ["==", ["get", "kind"], "sub"], "#2563eb", "#111827"],
            "line-width": [
              "case",
              ["==", ["get", "kind"], "sub"],
              ["case", ["==", ["get", "active"], 1], 3.5, ["==", ["get", "selected"], 1], 3.2, 2.5],
              2.5,
            ],
          },
        }, aboveLayer);

        map.addLayer({
          id: labelId,
          type: "symbol",
          source: sourceId,
          filter: ["all", ["!=", ["get", "kind"], "mask"], ["has", "label"]],
          layout: {
            "text-field": ["get", "label"],
            "text-size": 13,
            "text-anchor": "center",
          },
          paint: {
            "text-color": ["case", ["==", ["get", "kind"], "sub"], "#1d4ed8", "#111827"],
            "text-halo-color": "#fff",
            "text-halo-width": 1.2,
          },
        });
      } else {
        (map.getSource(sourceId) as maplibregl.GeoJSONSource).setData(data);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);

    return () => {
      map.off("load", apply);
    };
  }, [mode, primaryFocusArea, subFocusAreas, activeSubAreaIndex, selectedSubAreaIndex]);

  // Lightweight hover effect: update fill-opacity via setPaintProperty so we
  // don't rebuild the entire GeoJSON FeatureCollection on every mousemove.
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("focus-areas-fill")) return;

    const subOpacity: any[] = [
      "case",
      ["==", ["get", "active"], 1], 0.34,
      ["==", ["get", "selected"], 1], 0.32,
      ...(hoverSubAreaIndex != null ? [["==", ["get", "index"], hoverSubAreaIndex], 0.28] : []),
      0.2,
    ];

    map.setPaintProperty("focus-areas-fill", "fill-opacity", [
      "case",
      ["==", ["get", "kind"], "sub"],
      subOpacity,
      0.12,
    ] as any);
  }, [hoverSubAreaIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "explore") return;
    if (!map.getLayer("focus-areas-fill")) return;

    const handleMouseMove = (e: any) => {
      const feature = e.features?.[0];
      if (!feature || feature.properties?.kind !== "sub") {
        setHoverSubAreaIndex(null);
        return;
      }

      setHoverSubAreaIndex(Number(feature.properties.index));
    };

    const handleMouseLeave = () => {
      setHoverSubAreaIndex(null);
    };

    const handleClick = (e: any) => {
      const feature = e.features?.[0];
      if (!feature || feature.properties?.kind !== "sub") return;

      const index = Number(feature.properties.index);
      if (Number.isNaN(index)) return;

      setSelectedSubAreaIndex(index);
    };

    map.on("mousemove", "focus-areas-fill", handleMouseMove);
    map.on("mouseleave", "focus-areas-fill", handleMouseLeave);
    map.on("click", "focus-areas-fill", handleClick);

    return () => {
      map.off("mousemove", "focus-areas-fill", handleMouseMove);
      map.off("mouseleave", "focus-areas-fill", handleMouseLeave);
      map.off("click", "focus-areas-fill", handleClick);
    };
  }, [mode, subFocusAreas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const reg = dashboardRegistryRef.current;

    if (mode !== "dashboard") {
      openDashboardPopupRef.current?.remove();
      openDashboardPopupRef.current = null;

      for (const entry of reg.values()) cleanupDashEntry(entry);
      reg.clear();
      return;
    }

    showMapillarySigns = false;
    const markers = dashboardMarkers ?? [];
    const incomingKeys = new Set(markers.map((m) => String(m.id)));

    for (const m of markers) {
      const key = String(m.id);
      const existing = reg.get(key);

      if (!existing) {
        const { el, labelEl } = makeDashboardMarkerElement(m.label);

        const marker = new maplibregl.Marker({
          element: el,
          anchor: "bottom",
        })
          .setLngLat([m.lng, m.lat])
          .addTo(map);

        const entry: DashMarkerEntry = { marker, el, labelEl };
        reg.set(key, entry);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onDashboardMarkerClick?.(m.id);
          openDashboardPopup(map, entry, m);
        });
      } else {
        existing.marker.setLngLat([m.lng, m.lat]);
        const nextLabel = m.label ?? "";
        if (existing.labelEl.textContent !== nextLabel) {
          existing.labelEl.textContent = nextLabel;
        }
      }
    }

    for (const [key, entry] of reg.entries()) {
      if (!incomingKeys.has(key)) {
        cleanupDashEntry(entry);
        reg.delete(key);
      }
    }
  }, [dashboardMarkers, mode, onDashboardMarkerClick]);

  const beginAssignCamera = useCallback(() => {
    if (selectedPolygonIndexRef.current == null) return;
    setShowPolygonModal(false);
    setToolMode("assignCamera");
  }, [selectedPolygonIndexRef]);

  const deletePolygon = useCallback(async () => {
    const idx = selectedPolygonIndexRef.current;
    if (idx == null) return;

    const poly = completedPolygonsRef.current[idx];
    if (!poly) return;

    if (poly.cameraId != null) {
      try {
        await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${poly.cameraId}/polygon/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ polygon: null }),
        });
      } catch {}
    }

    setCompletedPolygons((prev) => prev.filter((_, i) => i !== idx));
    setShowPolygonModal(false);
    setSelectedPolygonIndex(null);
    setToolMode("none");
  }, [completedPolygonsRef, selectedPolygonIndexRef]);

  const cancelPolygonModal = useCallback(() => {
    setShowPolygonModal(false);
    setSelectedPolygonIndex(null);
    setToolMode("none");
  }, []);

  return (
    <div className={`map-wrap${showGeocoder ? " landing-map" : ""}`}>
      <div ref={mapContainer} className="map" />
      {mode === "explore" && (
          <SideTab side="bottom" open={open} invisible={false} onToggle={() => setOpen(!open)} style={{"display": "flex", "flexDirection": "column", "gap": "0.5em", "alignItems": "center"}}>
            <div className="explore-toolbar-header">
              <span className="explore-toolbar__step">
                {explorePhase === "drawing-sub"
                  ? activeSubAreaIndex != null
                    ? "Step 3 · Edit selected sub-area"
                    : "Step 3 · Draw a sub-area"
                  : explorePhase === "drawing-primary"
                    ? primaryFocusArea
                      ? "Step 2 · Adjust AOI"
                      : "Step 1 · Draw the AOI"
                    : primaryFocusArea
                      ? "Step 3 · Manage sub-areas"
                      : "Step 1 · Search and draw the AOI"
                }
              </span>

              <span className="explore-toolbar__label">
                {primaryFocusArea ? `AOI: ${primaryFocusArea.label}` : "Draw an AOI"}
                {subFocusAreas.length > 0 ? ` / ${subFocusAreas.length} sub-area${subFocusAreas.length > 1 ? "s" : ""}` : ""}
              </span>

              <span />
            </div>

            <div className="explore-toolbar__group">
              {primaryFocusArea && (
                <button
                  onClick={() => fitToFocusArea(primaryFocusArea)}
                  className="explore-toolbar__btn explore-toolbar__btn--neutral"
                  disabled={isDrawingFocusArea}
                >
                  Reset View
                </button>
              )}

              {!isDrawingFocusArea ? (
                <>
                  <button onClick={handleEditAoi} className="explore-toolbar__btn explore-toolbar__btn--outline" disabled={!hasConfirmedPrimary}>
                    Edit AOI
                  </button>

                  <button
                    onClick={deletePrimaryFocusArea}
                    className="explore-toolbar__btn explore-toolbar__btn--danger"
                    disabled={!hasConfirmedPrimary}
                  >
                    Delete AOI
                  </button>

                  <button
                    onClick={beginSubFocusDrawing}
                    className="explore-toolbar__btn explore-toolbar__btn--primary"
                    disabled={!hasConfirmedPrimary}
                  >
                    Add Sub-area
                  </button>

                  <button
                    onClick={() => {
                      if (selectedSubAreaIndex != null) {
                        handleEditSubArea(selectedSubAreaIndex);
                      }
                    }}
                    className="explore-toolbar__btn explore-toolbar__btn--sub"
                    disabled={!hasSelectedSubArea}
                  >
                    Edit Selected
                  </button>

                  <button
                    onClick={deleteSelectedSubArea}
                    className="explore-toolbar__btn explore-toolbar__btn--danger"
                    disabled={!hasSelectedSubArea}
                  >
                    Delete Selected
                  </button>
                </>
              ) : (
                <>
                  <button onClick={handleConfirmAoi} className="explore-toolbar__btn explore-toolbar__btn--primary">
                    {explorePhase === "drawing-sub"
                      ? activeSubAreaIndex != null
                        ? "Confirm Sub-area Edit"
                        : "Confirm Sub-area"
                      : primaryFocusArea
                        ? "Confirm AOI Edit"
                        : "Confirm AOI"}
                  </button>

                  <button onClick={cancelFocusDrawing} className="explore-toolbar__btn explore-toolbar__btn--neutral">
                    Cancel
                  </button>
                </>
              )}
            </div>

            {subFocusAreas.length > 0 && (
              <div className="explore-toolbar">
                <span className="explore-toolbar__label">Sub-areas</span>

                {subFocusAreas.map((area, index) => (
                  <button
                    key={`${area.label}-${index}`}
                    onClick={() => setSelectedSubAreaIndex(index)}
                    className={`explore-toolbar__btn explore-toolbar__btn--sub ${selectedSubAreaIndex === index ? "is-active" : ""}`}
                    disabled={isDrawingFocusArea}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            )}
          </SideTab>
      )}

      {isEditMode && mode === "map" && (
        <>
          {toolMode === "addPoint" && (
            <div className="map-hint">
              {polygonPoints.length === 0 && "Click on the map to start drawing a polygon"}
              {polygonPoints.length === 1 && "Click to add more points"}
              {polygonPoints.length === 2 && "Click to add at least one more point"}
              {polygonPoints.length >= 3 && (
                <>
                  Click the <span className="map-hint__accent">green starting point</span> to close the polygon
                </>
              )}
            </div>
          )}
        </>
      )}

      {showSuccessNotification && (
        <div className="map-toast map-toast--success">
          <span className="map-toast__icon">✓</span> Polygon created!
        </div>
      )}

      {isAssigningCamera && <div className="assign-camera-banner">Click on the camera you want this polygon assigned to</div>}

      {showPolygonModal && (
        <div className="polygon-modal">
          <h3 className="polygon-modal__title">Polygon Options</h3>
          <div className="polygon-modal__actions">
            <button onClick={beginAssignCamera} className="polygon-modal__btn polygon-modal__btn--primary">
              Assign to Camera
            </button>

            <button onClick={deletePolygon} className="polygon-modal__btn polygon-modal__btn--danger">
              Delete Polygon
            </button>

            <button onClick={cancelPolygonModal} className="polygon-modal__btn polygon-modal__btn--ghost">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { ToggleEditButton };
