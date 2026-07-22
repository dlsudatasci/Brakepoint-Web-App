import {
	Point, Polygon, PolygonCollection,
	toPolygonCollection, removePolygonFromCollection
} from "@/components/landing/polygonFunctions"

export type SummaryType = "area" | "subarea" | "camera"
export type SubAreaType = "road_segment" | "intersection" | "junction";

// unified standard type for vehicle_breakdown
export type VehicleBreakdown = {
	"Bus": number;
	"Car": number;
	"Jeepney": number;
	"Motorcycle": number;
	"Truck": number;
}

export function isVehicleBreakdown(obj: any): obj is VehicleBreakdown {
	return (obj !== undefined && "Bus" in obj && "Car" in obj && "Jeepney" in obj && "Motorcycle" in obj && "Truck" in obj)
}

export function sumBreakdowns(target: VehicleBreakdown, source?: Partial<VehicleBreakdown> | null) {
	if (!source) return target;
	target.Bus += source.Bus ?? 0;
	target.Car += source.Car ?? 0;
	target.Jeepney += source.Jeepney ?? 0;
	target.Motorcycle += source.Motorcycle ?? 0;
	target.Truck += source.Truck ?? 0;
	return target;
}

export function formatDurationLabel(totalSeconds?: number | null) {
	if (totalSeconds == null || Number.isNaN(totalSeconds)) return "0s";
	const secs = Math.max(0, Math.floor(totalSeconds));
	const hours = Math.floor(secs / 3600);
	const mins = Math.floor((secs % 3600) / 60);
	const rem = secs % 60;

	if (hours > 0) return `${hours}h ${mins}m ${rem}s`;
	if (mins > 0) return `${mins}m ${rem}s`;
	return `${rem}s`;
}

// convert both of the vehicle breakdown formats outputted by the AOI to this unified format
function convertBreakdownToUnifiedFormat(breakdown?: any) {
	const res: VehicleBreakdown = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0};
	if (breakdown === undefined) { return res; }

	// AOI api format
	if (breakdown.length && breakdown.length == 5) {
		for (const item of breakdown) {
			if (item.label in res) { res[item.label] = item.value }
		}
	}
	
	// subarea api format
	else if ("Car" in breakdown) {
		for (const item in breakdown) {
			if (item in res) { res[item] = breakdown[item] }
		}
	}

	// and done :>
	return res;
}

// contains generic information for a given location object (area/subarea/camera)
export type LocationSummary = {
	summary_type: SummaryType;
	id: number;
	name: string;
    location?: string;
    lat?: number;
    lng?: number;
	
    vehicles: number;
    adb: number;
    speeding: number;
    swerving: number;
    abrupt_stopping: number;

	parent?: number;
}

// contains camera-specific information
export type CameraSummary = LocationSummary & {
	polygon?: Polygon | PolygonCollection;

    is_calibrated: boolean;
    calibration_points?: {x: number, y: number}[];
    reference_points?:  {x: number, y: number}[];
    reference_distance_meters?: number;
    meter_per_pixel?: number;

    tags: string[];

	video_count?: number;
	video_ids: number[];
    latest_upload?: Date;
    behaviors: string[];
}

// contains subarea-specific information
export type SubAreaSummary = LocationSummary & {
    camera_count: number;
    cameras?: CameraSummary[]; // deprecated — please use camera_ids
	camera_ids?: number[]
    subarea_count: number;
    tags: string[];
	road_polygons?: PolygonCollection;
    // vehicle_breakdown: Record<string, number>;
	vehicle_breakdown?: VehicleBreakdown;
    sub_area_type: SubAreaType | null;
	geometry?: Polygon
};

// contains area-specific information
export type AOISummary = LocationSummary & {
    // vehicle_breakdown?: { label: string; value: number }[];
	vehicle_breakdown?: VehicleBreakdown;
    subarea_count: number;
    subareas?: SubAreaSummary[]; // deprecated — please use subarea_ids
	subarea_ids?: number[];
	geometry?: Polygon;
};
export type AreaSummary = AOISummary;

// type guards for the above functions
export function isSubareaSummary(summ: LocationSummary): summ is SubAreaSummary {
    return summ.summary_type == "subarea"
}
export function isCameraSummary(summ: LocationSummary): summ is CameraSummary {
    return summ.summary_type == "camera"
}
export function isAreaSummary(summ: LocationSummary): summ is AOISummary {
    return summ.summary_type == "area"
}

const default_values = {
	lat: 0,
	lng: 0,
	is_calibrated: false,
	tags: [],
	vehicles: 0,
	adb: 0,
	speeding: 0,
	swerving: 0,
	abrupt_stopping: 0,
	video_count: 0,
	behaviors: [],
	parent: -1,
}

export function convertObjectToCameraSummary(obj: any, additional: any = {}) {
	return {
		...default_values,
		...obj, ...additional,
		summary_type: "camera",
		adb: obj.adb ?? obj.occurrences ?? additional.adb ?? 0,
		parent: (obj.parent ?? additional.parent ?? obj.saved_location ?? additional.saved_location),
	} as CameraSummary
}

export function convertObjectToSubareaSummary(obj: any, additional: any = {}) {
	return {
		...default_values,
		...obj, ...additional,
		summary_type: "subarea",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown ?? {}),
		sub_area_type: obj.sub_area_type as SubAreaType | null,
		parent: (obj.parent ?? additional.parent ?? obj.parent_id ?? additional.parent_id),
	} as SubAreaSummary
}

export function convertObjectToAreaSummary(obj: any, additional: any = {}) {
	return {
		location: undefined,
		...default_values,
		...obj, ...additional,
		summary_type: "area",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown ?? {}),
		parent: -1,
	} as AOISummary
}



export type VideoSummary = {
	summaryType: "video"
	id: number;
	camera: number;
	filename?: string;
	file_size_mb?: number;
	start_time?: string | null;
	start_time_source?: "metadata" | "filename" | "failed" | string;
	duration_seconds: number;
	duration?: string;
	fps?: number;
	resolution: string;
	thumbnail: string;

	behaviors?: string[];
	vehicles?: number;
	occurrences?: number;
	speeding_count?: number;
	swerving_count?: number;
	abrupt_stopping_count?: number;
	processing_status?: "pending" | "processing" | "completed" | "failed" | string;

	// signs?: number; // TODO
	jeepney_hotspot?: boolean;
	uploaded_at: Date;
	recorded_at: Date;
	recorded_time_string?: string;
	uploaded_time_string?: string;
	vehicle_breakdown: VehicleBreakdown;
}

export function convertObjectToVideoSummary(obj: any, additional?: any) {
	const uploadedAtRaw = obj?.uploaded_at ?? additional?.uploaded_at;
	const recordedAtRaw = obj?.recorded_at ?? obj?.start_time ?? additional?.recorded_at ?? additional?.start_time ?? uploadedAtRaw;
	const uploadedAt = uploadedAtRaw ? new Date(uploadedAtRaw) : new Date();
	const recordedAt = recordedAtRaw ? new Date(recordedAtRaw) : uploadedAt;

	const safeUploadedAt = Number.isNaN(uploadedAt.getTime()) ? new Date() : uploadedAt;
	const safeRecordedAt = Number.isNaN(recordedAt.getTime()) ? safeUploadedAt : recordedAt;

	return {
		summaryType: "video",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown),
		vehicles: 0, occurrences: 0, speeding_count: 0, swerving_count: 0, abrupt_stopping_count: 0,
		...obj, ...additional,
		uploaded_at: safeUploadedAt,
		recorded_at: safeRecordedAt,
		recorded_time_string: (obj?.recorded_time_string ?? additional?.recorded_time_string),
		uploaded_time_string: (obj?.uploaded_time_string ?? additional?.uploaded_time_string),
		processing_status: (obj?.processing_status ?? additional?.processing_status ?? "pending"),
		duration: formatDurationLabel(obj?.duration_seconds ?? additional?.duration_seconds ?? 0),
	} as VideoSummary
}

export type AOIRecord = Record<number, AOISummary>;
export type SubareaRecord = Record<number, SubAreaSummary>;
export type CameraRecord = Record<number, CameraSummary>;
export type VideoRecord = Record<number, VideoSummary>;

// returns an array with all the values of a record
export function convertRecordToArray(record: Record<any, any>) {
	return Object.values(record)
}

export function getLengthOfRecord(record: Record<any, any>) {
	return Object.keys(record).length
}