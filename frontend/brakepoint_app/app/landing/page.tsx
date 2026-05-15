"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { Box } from "@mui/material";
import "./style.css";
const Map = dynamic(() => import("@components/map/map"), { ssr: false });

import SideMenu from "@/components/landing/sideMenu";

export default function LandingPage() {
  const [activeView, setActiveView] = useState<"analytics" | "edit">("analytics");

  return (
    <div className="landing-container">
      <Box>
        <SideMenu activeView={activeView} onViewChange={setActiveView} />
      </Box>
      <Map mode="landing" refreshTrigger={0}>

      </Map>
    </div>
  );
}