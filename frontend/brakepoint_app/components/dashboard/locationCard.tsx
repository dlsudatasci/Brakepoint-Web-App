"use client";

import { Box, Typography, List, ListItem, ListItemIcon, ListItemText, Chip } from "@mui/material";
import DirectionsCarFilledOutlinedIcon from "@mui/icons-material/DirectionsCarFilledOutlined";
import type { SubAreaSummary } from "./analytics";
import "./locationCard.css";

import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';                                  // vehicles icon
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";                  // ADB icon
import SpeedOutlinedIcon from "@mui/icons-material/SpeedOutlined";                                  // speeding icon
import SwapCallsIcon from "@mui/icons-material/SwapCalls";                                          // swerving icon
import PanToolOutlinedIcon from "@mui/icons-material/PanToolOutlined";                              // abrupt stopping icon
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';                        // rightwards icon
import { ReportProblem } from "@mui/icons-material";

// details for this area/subarea
// obtained from api/dashboard-summary; class SavedLocation in models.py
type LocationSummary = {
  location_type: "aoi" | "subarea";

  name: string;
  lat: number;
  lng: number;

  camera_count: number;
  subarea_count: number;

  vehicles: number;
  speeding: number;
  swerving: number;
  abrupt_stopping: number;
  adb: number;

  tags: string[];
}

// definition of types for the props for LocationCard
type LCProps = {
  type: "area" | "subarea";                     // whether this card is an area or a subarea (road segment) card
  locationDetails?: LocationSummary;            // details of the location to incorporate into this card
  onClickCard?: () => void;                     // what happens when the user clicks on the main card itself?
  onClickSideButton?: () => void;               // what happens when the user clicks on the highlighted side button?

  camera?: SubAreaSummary;                      // deprecated - subarea details. future uses of LC must use locationDetails, please!
  onClick?: () => void;                         // deprecated - triggers when the user clicks on this card
};

// LocationCard - displays an information card for a subarea (if applicable)
export default function LocationCard({ type, locationDetails, onClickCard, onClickSideButton, camera, onClick }: LCProps) {

  // move all details from deprecated camera to locationDetails
  if (camera && !locationDetails) {
    console.log(camera)
    type = "subarea"
    locationDetails = {
      location_type: "subarea",
      name: camera.name,
      lat: camera.lat, lng: camera.lng,
      camera_count: camera.camera_count, subarea_count: 0,
      vehicles: camera.vehicles,
      speeding: camera.speeding, swerving: camera.swerving, abrupt_stopping: camera.abrupt_stopping, adb: camera.adb,
      tags: camera.tags,
    }
  };

  // move details from deprecated onClick to onClickSideButton
  if (!onClickSideButton && onClick) {
    onClickSideButton = onClick;
  }

  // temp variables
  // const type = "area";
  const adbDisplay = type == "area" ? "row" : "list";

  return (
    <Box className="lc-container">
      {/* main - contains the main details regarding this card (area/subarea) */}
      <Box className="lc-main" onClick={onClickCard} >

        {/* header and subheader */}
        <div className="lc-header-container">
          <div className="lc-header">{locationDetails.name}</div>
          { type == "area" && (
            <div className="lc-subheader">{locationDetails.subarea_count} road segment{locationDetails.subarea_count == 1 ? "" : "s"} monitored</div>
          )}
        </div>

        {/* the list of adbs and other statistics as a quick-glance row */}
        { adbDisplay == "row" && (
          <div className="lc-stat-row">
            <div className="lc-stat"> <DirectionsCarIcon /> {locationDetails.vehicles} </div>
            <div className="lc-stat lc-adb"> <ReportProblemOutlinedIcon /> {locationDetails.adb} </div>
            <div className="lc-stat lc-adb"> <SpeedOutlinedIcon/> {locationDetails.speeding} </div>
            <div className="lc-stat lc-adb"> <SwapCallsIcon/> {locationDetails.swerving} </div>
            <div className="lc-stat lc-adb"> <PanToolOutlinedIcon/> {locationDetails.abrupt_stopping} </div>
          </div>
        )}

        {/* the list of adbs and other statistics as a list */}
        { adbDisplay == "list" && (
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

        {/* the list of tags that applies to this area/subarea */}
        { camera.tags && camera.tags.length > 0 && (
          <Box className="lc-tag-row">

            {camera.tags.map((tag) => (
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
