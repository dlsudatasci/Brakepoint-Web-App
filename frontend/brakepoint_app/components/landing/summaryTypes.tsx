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

export function sumBreakdowns(a?: VehicleBreakdown, b?: VehicleBreakdown) {
	if (a == undefined) a = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0}
	if (b == undefined) b = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0}
	for (const vehicle in a) {
		a[vehicle] += b[vehicle] ?? 0;
	}
	return a;
}

// convert both of the vehicle breakdown formats outputted by the AOI to this unified format
function convertBreakdownToUnifiedFormat(obj_breakdown: any, add_breakdown: any = {}) {
	let breakdown;
	if (obj_breakdown != undefined && Object.keys(obj_breakdown).length > 0) breakdown = obj_breakdown;
	else breakdown = add_breakdown;

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
    polygon?: [number, number][];

    is_calibrated: boolean;
    calibration_points?: {x: number, y: number}[];
    reference_points?:  {x: number, y: number}[];
    reference_distance_meters?: number;
    meter_per_pixel?: number;

    tags: string[];

	video_count?: number;
	video_ids: number[];
    latest_upload?: Date;
	latest_upload_id?: number;
	thumbnail?: string | null;
    behaviors: string[];

	vehicle_breakdown?: VehicleBreakdown;
}

// contains subarea-specific information
export type SubAreaSummary = LocationSummary & {
    camera_count: number;
    cameras?: CameraSummary[]; // deprecated — please use camera_ids
	camera_ids?: number[]
    tags: string[];
    // vehicle_breakdown: Record<string, number>;
	vehicle_breakdown?: VehicleBreakdown;
    sub_area_type: SubAreaType | null;
	geometry?: [number, number][]
};

// contains area-specific information
export type AOISummary = LocationSummary & {
    // vehicle_breakdown?: { label: string; value: number }[];
	vehicle_breakdown?: VehicleBreakdown;
    subarea_count: number;
    subareas?: SubAreaSummary[]; // deprecated — please use subarea_ids
	subarea_ids?: number[];
	geometry?: [number, number][]
};
export type AreaSummary = AOISummary;

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
		video_count: 0, video_ids: [],
		...default_values,
		...obj, ...additional,
		summary_type: "camera",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown, additional.vehicle_breakdown),
		adb: obj.adb ?? obj.occurrences ?? additional.adb ?? 0,
		parent: (obj.parent ?? additional.parent ?? obj.saved_location ?? additional.saved_location),
	} as CameraSummary
}

export function convertObjectToSubareaSummary(obj: any, additional: any = {}) {
	return {
		camera_count: 0, camera_ids: [],
		...default_values,
		...obj, ...additional,
		summary_type: "subarea",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown, additional.vehicle_breakdown),
		sub_area_type: obj.sub_area_type as SubAreaType | null,
		parent: (obj.parent ?? additional.parent ?? obj.parent_id ?? additional.parent_id),
	} as SubAreaSummary
}

export function convertObjectToAreaSummary(obj: any, additional: any = {}) {
	const res = {
		location: undefined,
		subarea_count: 0, subarea_ids: [],
		...default_values,
		...obj, ...additional,
		summary_type: "area",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown, additional.vehicle_breakdown),
		parent: -1,
	}
	return res as AOISummary
}





export type VideoSummary = {
	summary_type: "video"
	id: number;
	camera: number;
	filename?: string;
	file_size_mb?: number;
	start_time?: string | null;
	start_time_source?: "metadata" | "filename" | "failed" | "upload_time", string;
	fps?: number;
	resolution?: string;
	thumbnail?: string;
	
    calibration_points?: {x: number, y: number}[];
    reference_points?:  {x: number, y: number}[];
    reference_distance_meters?: number;
    meter_per_pixel?: number;

	duration_seconds: number;
	duration: string;

	behaviors?: string[];
	vehicles?: number;
	occurrences?: number;
	speeding_count?: number;
	swerving_count?: number;
	abrupt_stopping_count?: number;

	// signs?: number; // TODO
	jeepney_hotspot?: boolean;
	vehicle_breakdown: VehicleBreakdown;

	uploaded_at: Date;
	uploaded_time_string: string,
	uploaded_time_iso: string,
	recorded_at: Date;
	recorded_time_string: string,
	recorded_time_iso: string,
	
	processing_status: "completed" | "failed" | "processing" | "pending";

}

// formats a duration expressed in a number (representing seconds) to an hour/mins/seconds display
export function formatDurationLabel(durationSeconds?: number | null): string {
  if (typeof durationSeconds !== 'number' || Number.isNaN(durationSeconds) || durationSeconds <= 0) {
    return 'N/A';
  }

  if (durationSeconds < 60) {
    return `${Math.round(durationSeconds)}s`;
  }

  const totalSeconds = Math.round(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  return `${minutes}m ${seconds}s`;
}

export function convertObjectToVideoSummary(obj: any, additional: any = {}) {
	// if no start_time defined, borrow the uploaded_at time to serve as this
	const recordedAt = new Date(obj.start_time ?? additional.start_time ?? (new Date(obj.uploaded_at ?? additional.uploaded_at).getTime() - (1000 * (obj.duration_seconds ?? additional.duration_seconds)) ))
	const uploadedAt = obj.uploaded_at ? new Date(obj.uploaded_at) : additional.uploaded_at ? new Date(additional.uploaded_at) : null;
	const validRecordedAt = recordedAt && !isNaN(recordedAt.getTime()) ? recordedAt : null;
	const validUploadedAt = uploadedAt && !isNaN(uploadedAt.getTime()) ? uploadedAt : null;

	return {
		summary_type: "video", processing_status: "pending",
		vehicles: 0, occurrences: 0, speeding_count: 0, swerving_count: 0, abrupt_stopping_count: 0, signs: 0,
		jeepney_hotspot: false, duration_seconds: 0,
		calibration_points: [], reference_points: [],

		...obj, ...additional,
		
		duration: formatDurationLabel(obj.duration_seconds ?? additional.duration_seconds ?? 0),
		uploaded_at: uploadedAt, recorded_at: recordedAt,
		uploaded_time: validUploadedAt ? validUploadedAt.toLocaleString() : 'N/A',
		uploaded_time_iso: validUploadedAt ? validUploadedAt.toISOString() : null,
		recorded_time: validRecordedAt ? validRecordedAt.toLocaleString() : (validUploadedAt ? validUploadedAt.toLocaleString() : 'N/A'),
		recorded_time_iso: validRecordedAt ? validRecordedAt.toISOString() : (validUploadedAt ? validUploadedAt.toISOString() : null),
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown),
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



// type guards for the above functions
export function isAreaSummary(summ: LocationSummary | VideoSummary): summ is AOISummary {
    return summ.summary_type == "area"
}
export function isSubareaSummary(summ: LocationSummary | VideoSummary): summ is SubAreaSummary {
    return summ.summary_type == "subarea"
}
export function isCameraSummary(summ: LocationSummary | VideoSummary): summ is CameraSummary {
    return summ.summary_type == "camera"
}
export function isVideoSummary(summ: LocationSummary | VideoSummary): summ is VideoSummary {
    return summ.summary_type == "video"
}