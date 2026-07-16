export const BRAKEPOINT_SIGN_CLASSES = [
  "Direction Sign",
  "100kph Speed Limit Sign",
  "60kph Speed Limit Sign",
  "Pedestrian Sign",
  "Dangerous Road Sign",
  "Stop Sign",
  "30kph Speed Limit Sign",
  "80kph Speed Limit Sign",
  "40kph Speed Limit Sign",
  "No Turn Sign",
  "50kph Speed Limit Sign",
  "15kph Speed Limit Sign",
  "10kph Speed Limit Sign",
  "20kph Speed Limit Sign",
  "25kph Speed Limit Sign",
] as const;

export type BrakePointSignClass = (typeof BRAKEPOINT_SIGN_CLASSES)[number];

export const MAPILLARY_TO_BRAKEPOINT: Record<string, BrakePointSignClass> = {
  "regulatory--maximum-speed-limit-10":   "10kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-15":   "15kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-20":   "20kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-25":   "25kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-30":   "30kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-40":   "40kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-50":   "50kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-60":   "60kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-80":   "80kph Speed Limit Sign",
  "regulatory--maximum-speed-limit-100":  "100kph Speed Limit Sign",

  "regulatory--stop":                     "Stop Sign",

  "warning--pedestrians-crossing":        "Pedestrian Sign",
  "information--pedestrians-crossing":    "Pedestrian Sign",
  "regulatory--pedestrians-only":         "Pedestrian Sign",

  "regulatory--no-left-turn":             "No Turn Sign",
  "regulatory--no-right-turn":            "No Turn Sign",
  "regulatory--no-u-turn":                "No Turn Sign",

  "information--direction":               "Direction Sign",
  "guide--direction":                     "Direction Sign",
  "information--highway-exit":            "Direction Sign",
  "guide--destination":                   "Direction Sign",

  "warning--curve-left":                  "Dangerous Road Sign",
  "warning--curve-right":                 "Dangerous Road Sign",
  "warning--double-curve-first-left":     "Dangerous Road Sign",
  "warning--double-curve-first-right":    "Dangerous Road Sign",
  "warning--winding-road":                "Dangerous Road Sign",
  "warning--steep-ascent":                "Dangerous Road Sign",
  "warning--steep-descent":               "Dangerous Road Sign",
  "warning--slippery-road-surface":       "Dangerous Road Sign",
  "warning--road-narrows":                "Dangerous Road Sign",
  "warning--road-narrows-left":           "Dangerous Road Sign",
  "warning--road-narrows-right":          "Dangerous Road Sign",
  "warning--uneven-road":                 "Dangerous Road Sign",
  "warning--road-bump":                   "Dangerous Road Sign",
  "warning--other-danger":                "Dangerous Road Sign",
};

export const ALLOWED_MAPILLARY_PREFIXES = Object.keys(MAPILLARY_TO_BRAKEPOINT);

export function resolveBrakePointClass(mapillaryValue: string): BrakePointSignClass | null {
  for (const prefix of ALLOWED_MAPILLARY_PREFIXES) {
    if (mapillaryValue.startsWith(prefix)) {
      return MAPILLARY_TO_BRAKEPOINT[prefix];
    }
  }
  return null;
}

export const SIGN_CLASS_COLORS: Record<BrakePointSignClass, string> = {
  "10kph Speed Limit Sign":  "#e53935",
  "15kph Speed Limit Sign":  "#e53935",
  "20kph Speed Limit Sign":  "#e53935",
  "25kph Speed Limit Sign":  "#e53935",
  "30kph Speed Limit Sign":  "#e53935",
  "40kph Speed Limit Sign":  "#e53935",
  "50kph Speed Limit Sign":  "#e53935",
  "60kph Speed Limit Sign":  "#e53935",
  "80kph Speed Limit Sign":  "#e53935",
  "100kph Speed Limit Sign": "#e53935",
  "Stop Sign":                "#d32f2f",
  "Pedestrian Sign":          "#1e88e5",
  "No Turn Sign":             "#fb8c00",
  "Direction Sign":           "#43a047",
  "Dangerous Road Sign":      "#fdd835",
};

export const MAPILLARY_SOURCE_ID = "mapillary-traffic-signs";
export const MAPILLARY_LAYER_ID  = "mapillary-traffic-signs-layer";

export const SIGN_IMAGE_ID: Record<BrakePointSignClass, string> = {
  "10kph Speed Limit Sign":  "sign-speed-10",
  "15kph Speed Limit Sign":  "sign-speed-15",
  "20kph Speed Limit Sign":  "sign-speed-20",
  "25kph Speed Limit Sign":  "sign-speed-25",
  "30kph Speed Limit Sign":  "sign-speed-30",
  "40kph Speed Limit Sign":  "sign-speed-40",
  "50kph Speed Limit Sign":  "sign-speed-50",
  "60kph Speed Limit Sign":  "sign-speed-60",
  "80kph Speed Limit Sign":  "sign-speed-80",
  "100kph Speed Limit Sign": "sign-speed-100",
  "Stop Sign":               "sign-stop",
  "Pedestrian Sign":         "sign-pedestrian",
  "No Turn Sign":            "sign-no-turn",
  "Direction Sign":          "sign-direction",
  "Dangerous Road Sign":     "sign-dangerous",
};

export const SIGN_IMAGE_PATH = "./traffic-icons"

export function loadSignImages(map: any, token?: string): Promise<void> {
  // ── Early exit: all images already in the map's image atlas ───────────
  const allLoaded = ALLOWED_MAPILLARY_PREFIXES.every((prefix) => {
    const cls = MAPILLARY_TO_BRAKEPOINT[prefix];
    return map.hasImage(SIGN_IMAGE_ID[cls]);
  });
  if (allLoaded) return Promise.resolve();

  // ── Try Mapillary's own sprite first ──────────────────────────────────
  if (token) {
    const spriteBase = "https://api.mapillary.com/v4/sprite/traffic_sign@2x";
    const jsonUrl = `${spriteBase}.json?access_token=${encodeURIComponent(token)}`;
    const pngUrl  = `${spriteBase}.png?access_token=${encodeURIComponent(token)}`;

    const spriteAttempt = Promise.all([
      fetch(jsonUrl).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(pngUrl).then((r)  => (r.ok ? r.blob() : Promise.reject())),
    ]).then(([spriteJson, pngBlob]: [Record<string, any>, Blob]) => {
      const objectUrl = URL.createObjectURL(pngBlob);

      return new Promise<void>((resolve, reject) => {
        const img = new Image();

        img.onload = () => {
          let loaded = 0;

          for (const prefix of ALLOWED_MAPILLARY_PREFIXES) {
            const cls     = MAPILLARY_TO_BRAKEPOINT[prefix];
            const imageId = SIGN_IMAGE_ID[cls];
            if (map.hasImage(imageId)) { loaded++; continue; }

            // Find a sprite key that starts with this prefix
            const spriteKey = Object.keys(spriteJson).find((k) => k.startsWith(prefix));
            if (!spriteKey) continue;

            const { x, y, width, height } = spriteJson[spriteKey];
            if (!width || !height) continue;

            const canvas = document.createElement("canvas");
            canvas.width  = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

            if (!map.hasImage(imageId)) {
              map.addImage(imageId, ctx.getImageData(0, 0, width, height));
            }
            loaded++;
          }

          URL.revokeObjectURL(objectUrl);
          // Require at least half the signs loaded via sprite
          if (loaded >= Math.floor(ALLOWED_MAPILLARY_PREFIXES.length / 2)) resolve();
          else reject(new Error("Too few sprite icons loaded"));
        };

        img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(); };
        img.src = objectUrl;
      });
    });

    return spriteAttempt.catch(() => loadSvgFallback(map));
  }

  return loadSvgFallback(map);
}

/** SVG-based fallback icons (used when Mapillary sprite is unavailable) */
function loadSvgFallback(map: any): Promise<void> {
  const cls2img = Object.entries(SIGN_IMAGE_ID) as [BrakePointSignClass, string][];

  const tasks = cls2img.map(([cls, imageId]) => {
    if (map.hasImage(imageId)) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const url = `${SIGN_IMAGE_PATH}/${SIGN_IMAGE_ID[cls]}.svg`
      const img  = new Image();

      img.onload = () => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width  = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        if (!map.hasImage(imageId)) {
          map.addImage(imageId, ctx.getImageData(0, 0, size, size));
        }
        resolve();
      };

      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  });

  return Promise.all(tasks).then(() => undefined);
}

export function buildIconImageExpression(): any[] {
  const cases: any[] = [];

  for (const prefix of ALLOWED_MAPILLARY_PREFIXES) {
    const cls   = MAPILLARY_TO_BRAKEPOINT[prefix];
    const imgId = SIGN_IMAGE_ID[cls];
    cases.push(["==", ["slice", ["get", "value"], 0, prefix.length], prefix]);
    cases.push(imgId);
  }

  return ["case", ...cases, "sign-stop"]; 
}

export function mapillaryTileUrl(accessToken: string) {
  return `https://tiles.mapillary.com/maps/vtp/mly_map_feature_traffic_sign/2/{z}/{x}/{y}?access_token=${encodeURIComponent(accessToken)}`;
}

export function buildMapillaryFilter(): any[] {
  const conditions: any[] = ALLOWED_MAPILLARY_PREFIXES.map((prefix) => [
    "==",
    ["slice", ["get", "value"], 0, prefix.length],
    prefix,
  ]);

  return ["any", ...conditions];
}

export function buildColorExpression(): any[] {
  const cases: any[] = [];

  for (const prefix of ALLOWED_MAPILLARY_PREFIXES) {
    const cls = MAPILLARY_TO_BRAKEPOINT[prefix];
    const color = SIGN_CLASS_COLORS[cls];
    cases.push(["==", ["slice", ["get", "value"], 0, prefix.length], prefix]);
    cases.push(color);
  }

  return ["case", ...cases, "#9e9e9e"];
}
