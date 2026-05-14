"use client";

import { useState } from "react";
import { Box } from "@mui/material";

import SideMenu from "@/components/landing/sideMenu";

export default function LandingPage() {
  const [activeView, setActiveView] = useState<"analytics" | "edit">("analytics");

  return (
    <Box>
      <SideMenu activeView={activeView} onViewChange={setActiveView} />
    </Box>
  );
}