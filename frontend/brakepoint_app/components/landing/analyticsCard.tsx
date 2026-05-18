import { Box, Typography } from "@mui/material";
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PieChart } from "@mui/x-charts/PieChart";
import { LineChart } from "@mui/x-charts/LineChart";
import "./analyticsCard.css";

// what format to display this data point as
type DataView = "pie" | "bar" | "text";

// definition of types for the props for AnalyticsCard
type ACProps = {
  headerText: string;           // header text / statistic being displayed here
  icon?: React.ReactNode;       // icon to display
  variant?: DataView;           // what format to display this data point as
  valueText?: React.ReactNode;  // for text displays, the value to display
  data?: ChartData[];           // for pie displays, data to add to the chart
  compact?: boolean;            // display this card in a compact way?
};

// label-value pair to fill out a pie chart
export type ChartData = {
  label: string;
  value: number;
};

// stacked bar

const BAR_COLORS = ["#e63946", "#f4b961", "#4f8ef7", "#a855f7", "#06b6d4", "#10b981"];

export function StackedBar({ data }: { data: ChartData[] }) {
  const cleaned = useMemo(
    () => data.filter((d) => Number.isFinite(d.value) && d.value > 0),
    [data],
  );
  const total = useMemo(() => cleaned.reduce((s, d) => s + d.value, 0), [cleaned]);

  if (!cleaned.length || total === 0) {
    return <Box sx={{ height: 20, borderRadius: "8px", bgcolor: "#e5e7eb", width: "100%" }} />;
  }

  return (
    <Box>
      {/* proportional bar */}
      <Box sx={{ display: "flex", height: 20, borderRadius: "8px", overflow: "hidden", width: "100%" }}>
        {cleaned.map((d, i) => (
          <Box
            key={d.label}
            title={`${d.label}: ${d.value}`}
            sx={{
              width: `${(d.value / total) * 100}%`,
              bgcolor: BAR_COLORS[i % BAR_COLORS.length],
              transition: "width 0.4s ease",
            }}
          />
        ))}
      </Box>

      {/* Bar Chart Legend */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 16px", mt: 1.25 }}>
        {cleaned.map((d, i) => (
          <Box
            key={d.label} 
            sx={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 0.75, 
              minWidth: 0, 
              bgcolor: `${BAR_COLORS[i % BAR_COLORS.length]}10`, 
              border: `1px solid ${BAR_COLORS[i % BAR_COLORS.length]}40`, 
              padding: 1, 
              borderRadius: "12px" }}>
            <Box
              sx={{
                width: 9,
                height: 9,
                borderRadius: "50%",
                bgcolor: BAR_COLORS[i % BAR_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Typography
              sx={{
                fontSize: "0.7rem",
                color: "#555",
                flex: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#1d1f3f", flexShrink: 0 }}>
              {d.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// creates a textual legend for each entry in this pie chart
function PieLegend({
  data,
  total,
  colors,
}: {
  data: ChartData[];
  total: number;
  colors: string[];
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: 1,
        width: "100%",
        mt: 1.5,
      }}
    >
      {data.map((entry, i) => {
        const color = colors[i] ?? "#ccc";
        const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
        return (
          <Box
            key={entry.label}
            sx={{
              p: 1.25,
              borderRadius: "12px",
              bgcolor: `${color}10`,
              border: `1px solid ${color}40`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              minWidth: 0,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
              <Box sx={{ flexShrink: 0, width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: "0.8rem",
                  color: "#1d1f3f",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.label}
              </Typography>
            </Box>

            <Box sx={{ flexShrink: 0, display: "flex", alignItems: "baseline", gap: 0.5, ml: 0.5 }}>
              <Typography sx={{ fontWeight: 700, fontSize: "0.8rem" }}>
                {entry.value.toLocaleString()}
              </Typography>
              <Typography sx={{ fontSize: "0.7rem", color: "text.disabled" }}>
                ({pct}%)
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

// if there is no available data, use this to generate a placeholder empty pie
// function EmptyPie({ compact, label = "", pieId = "empty-pie-chart" }: { compact: boolean; label?: string; pieId?: string }) {
//   const chartSize = compact
//     ? { width: 180, height: 160, innerRadius: 35, outerRadius: 70 }
//     : { width: 240, height: 220, innerRadius: 45, outerRadius: 90 };

//   return (
//     <Box sx={{ position: "relative", width: "100%", minHeight: chartSize.height, display: "grid", placeItems: "center" }}>
//       <PieChart
//         width={chartSize.width}
//         height={chartSize.height}
//         margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
//         hideLegend
//         series={[
//           {
//             id: pieId,
//             data: [{ id: 0, label: "No data found", value: 1, color: "#e5e7eb" }],
//             innerRadius: compact ? 35 : 45,
//             outerRadius: compact ? 70 : 90,
//             paddingAngle: 0,
//             cornerRadius: 0,
//           },
//         ]}
//       />

//       {/* Center label */}
//       <Box
//         sx={{
//           position: "absolute",
//           inset: 0,
//           display: "grid",
//           placeItems: "center",
//           pointerEvents: "none",
//           textAlign: "center",
//         }}
//       >
//         <Typography variant="body2" sx={{ color: "#9ca3af", fontWeight: 500 }}>
//           {label}
//         </Typography>
//       </Box>
//     </Box>
//   );
// }

// displays a pie chart for this analytics card
// function DefaultPie({ data, compact, pieId = "pie-chart" }: { data: ChartData[]; compact: boolean; pieId?: string }) {
//   // clean input data: remove all zero/negative/inf/NaN values
//   const cleaned = useMemo(
//     () => data.map((d) => ({ ...d, value: Number.isFinite(d.value) ? Math.max(0, d.value) : 0 })).filter((d) => d.value > 0),
//     [data],
//   );

//   const total = useMemo(() => cleaned.reduce((sum, d) => sum + d.value, 0), [cleaned]);

//   const chartSize = compact
//     ? { width: 180, height: 160, innerRadius: 35, outerRadius: 70 }
//     : { width: 240, height: 220, innerRadius: 45, outerRadius: 90 };

//   const wrapperRef = useRef<HTMLDivElement>(null);
//   const [sliceColors, setSliceColors] = useState<string[]>([]);

//   useEffect(() => {
//     const el = wrapperRef.current;
//     if (!el) return;

//     const id = requestAnimationFrame(() => {
//       const paths = el.querySelectorAll<SVGPathElement>("path[fill]");
//       const colors = Array.from(paths)
//         .map((p) => p.getAttribute("fill") ?? "")
//         .filter(Boolean);
//       if (colors.length) setSliceColors(colors);
//     });

//     return () => cancelAnimationFrame(id);
//   }, [cleaned]);

//   if (!cleaned.length) {
//     return <EmptyPie compact={compact} pieId={`${pieId}-empty`} />;
//   }

//   return (
//     <div ref={wrapperRef}>
//       <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
//         <PieChart
//           width={chartSize.width}
//           height={chartSize.height}
//           margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
//           hideLegend
//           series={[
//             {
//               id: pieId,
//               data: cleaned.map((d, i) => ({ id: i, label: d.label, value: d.value })),
//               innerRadius: compact ? 35 : 45,
//               outerRadius: compact ? 70 : 90,
//               paddingAngle: 2,
//               cornerRadius: 0,
//               valueFormatter: (item) => `${item.value}`,
//             },
//           ]}
//         />
//       </Box>
//       <PieLegend data={cleaned} total={total} colors={sliceColors} />
//     </div>
//   );
// }

function Fallback({ label }: { label: string }) {
  return (
    <Box
      sx={{
        width: "100%",
        border: "1px dashed rgba(0,0,0,0.2)",
        borderRadius: 2,
        display: "grid",
        placeItems: "center",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}

// analytics card to display various analytics to the user
export default function AnalyticsCard({ headerText, icon, variant = "text", valueText, data, compact = false }: ACProps) {
  return (
    <Box className="ac-container">
      {/* header and icon */}
      <Box className="ac-header">
        <Typography variant={compact ? "body2" : "h6"} fontWeight={600}>
          {headerText}
        </Typography>
        <Box className="ac-icon" sx={{ display: "grid", placeItems: "center" }}>
          {icon ?? null}
        </Box>
      </Box>

      <Box className="ac-content">
        {/* for text display: display the valueText / statistic count */}
        {variant === "text" && (
          <Box className="ac-text">
            <Typography variant={compact ? "h5" : "h4"} fontWeight={700}>
              {valueText ?? "—"}
            </Typography>
          </Box>
        )}

        {/* {variant === "pie" && (
          <Box className="ac-pie" sx={{ display: "flex", flexDirection: "column" }}>
            <DefaultPie data={data ?? []} compact={compact} pieId={`${headerText}-pie`} />
          </Box>
        )} */}

        {/* for bar display: displays the stacked bar chart */}
        {variant === "bar" && (
          <Box className="ac-bar" sx={{ mt: 1 }}>
            <StackedBar data={data ?? []} />
          </Box>
        )}
      </Box>
    </Box>
  );
}