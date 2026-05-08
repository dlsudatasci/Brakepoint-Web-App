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

function speedSvg(num: number): string {
  const label = String(num);
  const fs = num >= 100 ? 20 : 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <circle cx="26" cy="26" r="25" fill="white" stroke="#cc0000" stroke-width="5"/>
  <text x="26" y="32" text-anchor="middle" font-family="Arial Black,Arial,sans-serif"
        font-size="${fs}" font-weight="900" fill="#111">${label}</text>
</svg>`;
}

function stopSvg(): string {
  const r = 23, cx = 26, cy = 26;
  const pts: string[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 8) + (i * Math.PI) / 4;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <polygon points="${pts.join(" ")}" fill="#cc0000" stroke="white" stroke-width="2"/>
  <text x="26" y="32" text-anchor="middle" font-family="Arial Black,Arial,sans-serif"
        font-size="16" font-weight="900" fill="white" letter-spacing="1">STOP</text>
</svg>`;
}

function pedestrianSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <rect x="2" y="2" width="48" height="48" rx="4" fill="#1565C0" stroke="white" stroke-width="2"/>
  <!-- head -->
  <circle cx="26" cy="12" r="4" fill="white"/>
  <!-- body / walking pose -->
  <line x1="26" y1="16" x2="26" y2="30" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <line x1="26" y1="22" x2="20" y2="27" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="26" y1="22" x2="32" y2="27" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
  <line x1="26" y1="30" x2="20" y2="40" stroke="white" stroke-width="3" stroke-linecap="round"/>
  <line x1="26" y1="30" x2="32" y2="40" stroke="white" stroke-width="3" stroke-linecap="round"/>
</svg>`;
}

function noTurnSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52">
  <circle cx="26" cy="26" r="24" fill="white" stroke="#cc0000" stroke-width="4"/>
  <!-- turn arrow -->
  <path d="M22 34 Q18 20 30 20 L28 16 L36 22 L28 28 L30 24 Q22 24 26 34 Z"
        fill="#333" stroke="none"/>
  <!-- diagonal ban line -->
  <line x1="10" y1="10" x2="42" y2="42" stroke="#cc0000" stroke-width="5" stroke-linecap="round"/>
</svg>`;
}

function directionSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="44" viewBox="0 0 60 44">
  <rect x="2" y="2" width="56" height="40" rx="3" fill="#1565C0" stroke="white" stroke-width="2"/>
  <polygon points="20,12 40,22 20,32" fill="white"/>
</svg>`;
}

function dangerousSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="52" height="48" viewBox="0 0 52 48">
  <polygon points="26,3 50,45 2,45" fill="#FFD600" stroke="#333" stroke-width="3" stroke-linejoin="round"/>
  <text x="26" y="42" text-anchor="middle" font-family="Arial Black,Arial,sans-serif"
        font-size="28" font-weight="900" fill="#333">!</text>
</svg>`;
}

export function getSignSvg(cls: BrakePointSignClass): string {
  if (cls === "Stop Sign")         return stopSvg();
  if (cls === "Pedestrian Sign")   return pedestrianSvg();
  if (cls === "No Turn Sign")      return noTurnSvg();
  if (cls === "Direction Sign")    return directionSvg();
  if (cls === "Dangerous Road Sign") return dangerousSvg();
  const m = cls.match(/^(\d+)kph/);
  if (m) return speedSvg(parseInt(m[1], 10));
  return speedSvg(0);
}

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
      const svg  = getSignSvg(cls);
      const blob = new Blob([svg], { type: "image/svg+xml" });
      const url  = URL.createObjectURL(blob);
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
