"use client";

import { Box, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function ModeSegmentedControl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMode = pathname.startsWith("/monitoring")
    ? "monitoring"
    : "configuration";

  const handleChange = (
    _event: React.MouseEvent<HTMLElement>,
    nextMode: "configuration" | "monitoring" | null
  ) => {
    if (!nextMode || nextMode === currentMode) return;

    const params = new URLSearchParams(searchParams.toString());
    const nextPath =
      nextMode === "monitoring" ? "/monitoring" : "/configuration";

    const nextUrl = params.toString()
      ? `${nextPath}?${params.toString()}`
      : nextPath;

    router.push(nextUrl);
  };

  return (
    <Box
      sx={{width: "100%", mt: "1.5em"}}
    >
      <ToggleButtonGroup
        value={currentMode}
        exclusive
        //onChange={handleChange}
        sx={{
          width: "100%",
          backgroundColor: "#fff",
          borderRadius: "14px",
          padding: "4px",
          overflow: "hidden",
          "& .MuiToggleButtonGroup-grouped": {
            flex: 1,
            border: "none",
            borderRadius: "10px !important",
            textTransform: "none",
            fontWeight: 600,
            px: 2.5,
            py: 1,
            color: "#161b4c",
          },
          "& .Mui-selected": {
            backgroundColor: "#161b4c !important",
            color: "#fff !important",
          },
        }}
      >
        <ToggleButton value="configuration">Feed</ToggleButton>
        <ToggleButton value="monitoring">Statistics</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
}