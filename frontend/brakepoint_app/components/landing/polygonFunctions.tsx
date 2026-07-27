export type Point = [number, number];
export type Polygon = Point[];				// [number, number][]
export type PolygonCollection = Polygon[];	// [number, number][][]
export type PolygonOrPolygonCollection = Polygon | PolygonCollection;

// checks if a given object is a Point
export function isPoint(obj: any): obj is Point {
	if (!Array.isArray(obj)) return false;
	return obj.length === 2 && typeof obj[0] === "number" && typeof obj[1] === "number";
}

// checks if a given object is a single Polygon
export function isPolygon(obj: any): obj is Polygon {
	if (!Array.isArray(obj) || obj.length === 0) return false; // not an array or no points
	return isPoint(obj[0]);
}

// checks if a given object is a PolygonCollection
export function isPolygonCollection(obj: any): obj is PolygonCollection {
	if (!Array.isArray(obj)) return false; // not an array
	if (obj.length === 0) return true; // collection with zero points
	return isPolygon(obj[0]) // defer to check if item 1 is a polygon
}

// checks if two points are equivalent
export function pointsAreEquivalent(p1: Point, p2: Point) {
	if (!isPoint(p1) || !isPoint(p2)) return false;
	return p1[0] == p2[0] && p1[1] == p2[1];
}

// checks if two polygons are equivalent
export function polygonsAreEquivalent(p1: Polygon, p2: Polygon) {
	if (!isPolygon(p1) || !isPolygon(p2)) return false;
	return JSON.stringify(p1) === JSON.stringify(p2);
}

// checks for and gets the index of polygonToFind in collection if present; otherwise returns null
// if collection is just a Polygon, returns a boolean
export function isPolygonInPolygonCollection(collection: PolygonCollection | Polygon, polygonToFind: Polygon) {
	if (isPolygon(collection)) {
		polygonsAreEquivalent(collection, polygonToFind);
	} else if (isPolygonCollection(collection)) {
		for (const pid in collection) {
			if (polygonsAreEquivalent(collection[pid], polygonToFind)) return pid; 
		}
	}
	return null;
}

// converts a given object to a Polygon or PolygonCollection object, whatever is most relevant
export function toPolygonCollection (value: Polygon | PolygonCollection | null | undefined) {
	if (!Array.isArray(value) || value.length === 0) return [] as PolygonCollection;

	const first = value[0] as any;
	const isRing = Array.isArray(first) && first.length === 2 && typeof first[0] === "number" && typeof first[1] === "number";
	if (isRing) return [value as Polygon];

	return value as PolygonCollection;
};

// adds a new polygon to this collection not-in-place
export function addPolygonToCollection ( currentCollection: Polygon | PolygonCollection | null | undefined , newPolygon: Polygon) {
	currentCollection = toPolygonCollection(currentCollection);
	let res: PolygonCollection = [];

	if (Array.isArray(currentCollection) && currentCollection.length === 0) {
		// res is empty array — start as a new PolygonCollection
		res = [newPolygon];
	} else if (isPolygonCollection(currentCollection)) {
		// res is PolygonCollection — simple append
		res = [...currentCollection, newPolygon];
	} else if (isPolygon(currentCollection)) {
		// res is Polygon — turn into a Collection with two items
		res = [currentCollection, newPolygon];
	} else {
		// res is undefined or null — start as a new PolygonCollection
		res = [newPolygon];
	}

	return res;
}

// removes a selected polygon from a PolygonCollection object not-in-place, if present
export function removePolygonFromCollection ( currentCollection: Polygon | PolygonCollection | null | undefined, targetPolygon: Polygon) {
	// can't remove anything from nothing. return empty array
	if (!Array.isArray(currentCollection) || currentCollection.length === 0) return [];
	let res: PolygonCollection = []

	if (isPolygonCollection(currentCollection)) {
		// res is polygon collection — check if res includes polygon and filter it out
		res = currentCollection.filter((polygon) => !polygonsAreEquivalent(polygon, targetPolygon))
	} else if (isPolygon(currentCollection)) {
		// res is polygon — return as a polygon collection with this polygon if equivalent, as empty collection if not
		if (polygonsAreEquivalent(currentCollection, targetPolygon)) res = []
		else res = [currentCollection];
	} else {
		// res is undefined or null — return as empty PolygonCollection
		res = [];
	}

	return res;
};

// patches a polygon within a PolygonCollection or a updates a single polygon if it matches.
export function patchPolygonFromCollection( currentCollection: Polygon | PolygonCollection | null | undefined, targetPolygonOld: Polygon, targetPolygonNew: Polygon) {
	// can't remove anything from nothing.
	const newCollection = currentCollection;
	if (!Array.isArray(currentCollection) || currentCollection.length === 0) return [] as PolygonCollection;
	
	if (isPolygonCollection(currentCollection)) {
		// is polygon in collection?
		const polygonIdx = isPolygonInPolygonCollection(currentCollection, targetPolygonOld);
		if (polygonIdx == null) return newCollection as PolygonCollection;
		newCollection[polygonIdx] = targetPolygonNew;
		return newCollection as PolygonCollection;
	} else if (isPolygon(currentCollection)) {
		// do we patch the one polygon we have?
		if (polygonsAreEquivalent(currentCollection, targetPolygonOld)) return [targetPolygonNew] as PolygonCollection;
		else return [currentCollection] as PolygonCollection
	}
	
}