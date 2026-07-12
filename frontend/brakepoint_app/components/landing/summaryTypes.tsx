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
	polygon?: [number, number][] | [number, number][][];

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
	fps?: number;
	resolution: string;
	thumbnail: string;

	behaviors?: string[];
	vehicles?: number;
	occurrences?: number;
	speeding_count?: number;
	swerving_count?: number;
	abrupt_stopping_count?: number;

	// signs?: number; // TODO
	jeepney_hotspot?: boolean;
	uploaded_at: Date;
	vehicle_breakdown: VehicleBreakdown;
}

export function convertObjectToVideoSummary(obj: any, additional?: any) {
	return {
		summaryType: "video",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown),
		...obj, ...additional,
		vehicles: 0, occurrences: 0, speeding_count: 0, swerving_count: 0, abrupt_stopping_count: 0,
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