"use client";

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Chip } from "@mui/material";
import { SubAreaSummary, LocationSummary, isAreaSummary, isSubareaSummary, isCameraSummary } from "@components/landing/summaryTypes"

import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
//import type { SubAreaSummary } from "./analytics";
import "./locationCard.css";

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';                                  // vehicles icon
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";                  // ADB icon
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";                                  // speeding icon
import SwapCallsIcon from "@mui/icons-material/SwapCalls";                                          // swerving icon
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";                              // abrupt stopping icon
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';                        // rightwards icon
import { ReportProblem } from "@mui/icons-material";

export type SubAreaSummaryLegacy = {
  id: number;
  name: string;
  lat: number;
  lng: number;
  geometry: [number, number][] | null;
  bounds: [[number, number], [number, number]] | null;
  camera_count: number;
  vehicles: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
  adb: number;
  tags: string[];
  thumbnail?: string | null;
  location?: string;
};

// definition of types for the props for LocationCard
type LCProps = {
  type: "area" | "subarea" | "camera";          // whether this card is an area or a subarea (road segment) card
  // details of the location to incorporate into this card
  locationDetails?: LocationSummary;            
  onClickCard?: () => void;                     // what happens when the user clicks on the main card itself?
  onClickSideButton?: () => void;               // what happens when the user clicks on the highlighted side button?
  isAlert?: undefined | true | false;           // force alert status. by default, triggers if camera_count == 0
};

// LocationCard - displays an information card for a subarea (if applicable)
export default function LocationCard({ type, locationDetails, onClickCard, onClickSideButton, isAlert }: LCProps) {

  // if isAlert is not set, set it automatically based on how the locationDetails are set up
  if (isAlert === undefined && isSubareaSummary(locationDetails)) {
    if (locationDetails.camera_count < 1) { isAlert = true }
    else { isAlert = false; }
  }

  return (
    <Box className={`lc-container ${isAlert ? "alert" : ""}`}>
      {/* main - contains the main details regarding this card (area/subarea) */}
      <Box className="lc-main" onClick={onClickCard} >

        {/* header and subheader */}
        <div className="lc-header-container">
          <div className="lc-header">{locationDetails.name}</div>
          { type == "area" && isAreaSummary(locationDetails) && (
            <div className="lc-subheader">{locationDetails.subarea_count} subarea{locationDetails.subarea_count == 1 ? "" : "s"} monitored</div>
          )}
        </div>
        
        {/* deprecated - the list of adbs and other statistics as a quick-glance row */}
        {/*
        { adbDisplay == "row" && (
          <div className="lc-stat-row">
            <div className="lc-stat"> <DirectionsCarIcon /> {locationDetails.vehicles} </div>
            <div className="lc-stat lc-adb"> <ReportProblemOutlinedIcon /> {locationDetails.adb} </div>
            <div className="lc-stat lc-adb"> <SpeedOutlinedIcon/> {locationDetails.speeding} </div>
            <div className="lc-stat lc-adb"> <SwapCallsIcon/> {locationDetails.swerving} </div>
            <div className="lc-stat lc-adb"> <PanToolOutlinedIcon/> {locationDetails.abrupt_stopping} </div>
          </div>
        )} */}

        {/* the list of adbs and other statistics as a textual list */}
        { !isCameraSummary(locationDetails) && (
          <div className="lc-stat-list">
            <div>
              <div className="lc-stat"> <DirectionsCarIcon /> <span><b>{locationDetails.vehicles}</b> total vehicles</span> </div>
              <div className="lc-stat lc-adb"> <ReportProblemOutlinedIcon /> <span><b>{locationDetails.adb}</b> total ADB</span> </div>
            </div>
            <div>
            <div className="lc-stat lc-adb"> <SpeedOutlinedIcon/> <span><b>{locationDetails.speeding}</b> speeding</span> </div>
            <div className="lc-stat lc-adb"> <SwapCallsIcon/> <span><b>{locationDetails.swerving}</b> swerving</span> </div>
            <div className="lc-stat lc-adb"> <PanToolOutlinedIcon/> <span><b>{locationDetails.abrupt_stopping}</b> abrupt stops</span> </div>
            </div>
          </div>
        )}

        {/* the number of videos uploaded and last video uploaded display */}
        { isCameraSummary(locationDetails) && (
          <Box className="lc-dateContainer">
            <span><b>{locationDetails.videoCount ?? "0"}</b> video{locationDetails.videoCount == 1 ? "" : "s"} uploaded</span>
            <span>Last video uploaded on <b>{locationDetails.latest_upload ? locationDetails.latest_upload.getDate() : "—"}</b></span>
          </Box>
        )}

        {/* the list of tags that applies to this area/subarea */}
        { (isSubareaSummary(locationDetails) || isCameraSummary(locationDetails)) && locationDetails.tags.length > 0 && (
          <Box className="lc-tag-row">

            {locationDetails.tags.map((tag) => (
              <div key={tag} className="lc-tag">
                {tag}
              </div>
            ))}

          </Box>
        )}

      </Box>
      
      {/* button - click here to go to the detailed menu */}
      <Box className="lc-button" onClick={onClickSideButton} >
        <KeyboardArrowRightIcon />
      </Box>
    </Box>
  );
}
