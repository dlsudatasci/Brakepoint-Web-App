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
function convertBreakdownToUnifiedFormat(breakdown: any) {
	const res: VehicleBreakdown = {"Bus": 0, "Car": 0, "Jeepney": 0, "Motorcycle": 0, "Truck": 0};
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

	videoCount?: number;
    latest_upload?: Date;
    behaviors: string[];
}

// contains subarea-specific information
export type SubAreaSummary = LocationSummary & {
    camera_count: number;
    cameras?: CameraSummary[];
    subarea_count: number;
    tags: string[];
    // vehicle_breakdown: Record<string, number>;
	vehicle_breakdown?: VehicleBreakdown;
    sub_area_type: SubAreaType | null;
};

// contains area-specific information
export type AOISummary = LocationSummary & {
    subarea_count: number;
    camera_count: number;
    // vehicle_breakdown?: { label: string; value: number }[];
	vehicle_breakdown?: VehicleBreakdown;
    subareas?: SubAreaSummary[];
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
}

export function convertObjectToCameraSummary(obj: any, additional?: any) {
	return {
		summary_type: "camera",
		...default_values,
		...obj, ...additional,
		adb: obj.adb ?? obj.occurrences ?? additional.adb ?? 0,
	} as CameraSummary
}

export function convertObjectToSubareaSummary(obj: any, additional?: any) {
	return {
		summary_type: "subarea",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown ?? {}),
		...default_values,
		...obj, ...additional,
		sub_area_type: obj.sub_area_type as SubAreaType | null,
	} as SubAreaSummary
}

export function convertObjectToAreaSummary(obj: any, additional?: any) {
	return {
		summary_type: "area",
		vehicle_breakdown: convertBreakdownToUnifiedFormat(obj.vehicle_breakdown ?? additional.vehicle_breakdown ?? {}),
		...default_values,
		...obj, ...additional,
		location: undefined,
	} as AOISummary
}

/*
export function convertObjectToSummary(type: SummaryType, obj: any, additional?: any) {
	// fill in initial data
	let res = {
		summary_type: type,
		lat: obj.lat ?? additional.lat ?? 0,
		lng: obj.lng ?? additional.lng ?? 0,
		vehicles: 0,
		adb: 0,
		speeding: 0,
		swerving: 0,
		abrupt_stopping: 0,
		...obj
	} as LocationSummary;
	
	switch (type) {
		case "area":
			return {
				...default_values,
				...obj, ...res, ...additional,
				location: undefined,
			} as AOISummary
			break;

		case "subarea":
			return {
				...obj, ...res, ...additional,
				tags: obj.tags ?? [],
                sub_area_type: obj.sub_area_type as SubAreaType | null,
			} as SubAreaSummary
			break;

		case "camera":
			return {
				...obj, ...res, ...additional
			} as CameraSummary
			break;
	}

	return res;
}
	*/