import { SubAreaType } from "@/components/landing/summaryTypes";

export type LandingAoiDto = {
  id: number;
  name: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  geometry?: [number, number][];
  bounds?: [[number, number], [number, number]];
  location_type?: "aoi";
  sub_area_type?: SubAreaType | null;
  parent_id?: number | null;
  subarea_count?: number;
  subarea_ids?: number[];
  camera_count?: number;
  vehicles?: number;
  occurrences?: number;
  adb?: number;
  speeding?: number;
  swerving?: number;
  abrupt_stopping?: number;
  behaviors?: string[];
  vehicle_breakdown?: Record<string, number>;
};

export type LandingSubareaDto = {
  id: number;
  name: string;
  lat?: number;
  lng?: number;
  zoom?: number;
  bearing?: number;
  pitch?: number;
  geometry?: [number, number][];
  bounds?: [[number, number], [number, number]];
  location_type?: "sub_area";
  sub_area_type?: SubAreaType | null;
  parent_id?: number | null;
  camera_count?: number;
  camera_ids?: number[];
  vehicles?: number;
  occurrences?: number;
  adb?: number;
  speeding?: number;
  swerving?: number;
  abrupt_stopping?: number;
  behaviors?: string[];
  vehicle_breakdown?: Record<string, number>;
};

export type LandingCameraDto = {
  id: number;
  name: string;
  lat?: number;
  lng?: number;
  location?: string;
  polygon?: [number, number][] | [number, number][][] | null;
  saved_location?: number | null;
  is_calibrated?: boolean;
  calibration_points?: { x: number; y: number }[];
  reference_points?: { x: number; y: number }[];
  reference_distance_meters?: number | null;
  meter_per_pixel?: number | null;
  tags?: string[];
  video_count?: number;
  video_ids?: number[];
  latest_upload?: string | null;
  vehicles?: number;
  occurrences?: number;
  adb?: number;
  speeding?: number;
  swerving?: number;
  abrupt_stopping?: number;
  behaviors?: string[];
  vehicle_breakdown?: Record<string, number>;
};

export type LandingVideoDto = {
  id: number;
  camera: number;
  filename?: string;
  uploaded_at?: string;
  thumbnail?: string;
  resolution?: string;
  calibration_points?: { x: number; y: number }[];
  reference_points?: { x: number; y: number }[];
  reference_distance_meters?: number | null;
  vehicles?: number;
  occurrences?: number;
  speeding_count?: number;
  swerving_count?: number;
  abrupt_stopping_count?: number;
  vehicle_breakdown?: Record<string, number>;
  [key: string]: unknown;
};

export type LandingVideoDetailResponse = {
  success: boolean;
  videos?: LandingVideoDto;
  error?: string;
};

export type LandingObjectsResponse = {
  success: boolean;
  aois: LandingAoiDto[];
  subareas: LandingSubareaDto[];
  cameras: LandingCameraDto[];
  videos: LandingVideoDto[];
  error?: string;
};

export function isLandingObjectsResponse(value: unknown): value is LandingObjectsResponse {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<LandingObjectsResponse>;

  return (
    typeof payload.success === "boolean" &&
    Array.isArray(payload.aois) &&
    Array.isArray(payload.subareas) &&
    Array.isArray(payload.cameras) &&
    Array.isArray(payload.videos)
  );
}

export function isLandingVideoDto(value: unknown): value is LandingVideoDto {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<LandingVideoDto>;
  return typeof payload.id === "number" && typeof payload.camera === "number";
}

export function isLandingVideoDetailResponse(value: unknown): value is LandingVideoDetailResponse {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<LandingVideoDetailResponse>;
  if (typeof payload.success !== "boolean") return false;
  if (payload.videos === undefined) return true;
  return isLandingVideoDto(payload.videos);
}
