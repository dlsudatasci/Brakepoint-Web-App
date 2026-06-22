"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Chip, CircularProgress, Divider, IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import styles from "./menuBar.module.css";
import { authFetch } from "@/lib/authFetch";
import { useNotifications } from "@/contexts/NotificationContext";

// components
import AnalyticsCard, { StackedBar } from "./analyticsCard";
import LocationCard from "./locationCard";
import ModeSegmentedControl from "@/components/landing/modeToggle";
import LandingSection from "@/components/landing/landingSection"
import Timeline from "@/components/landing/timeline";
import {
    SubAreaType, SummaryType,
    LocationSummary, AOISummary, SubAreaSummary, CameraSummary,
    isAreaSummary, isSubareaSummary, isCameraSummary,
    convertObjectToAreaSummary, convertObjectToSubareaSummary, convertObjectToCameraSummary,
    VideoSummary, convertObjectToVideoSummary,
    AOIRecord, SubareaRecord, CameraRecord, VideoRecord, convertRecordToArray,
    VehicleBreakdown
} from "@/components/landing/summaryTypes";
import CameraTags from "@/components/ui/cameraTags";
import VideoTable from "@/components/ui/table";

// icons
import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import EditIcon from '@mui/icons-material/Edit';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import UploadIcon from '@mui/icons-material/Upload';

// css
import "./sideMenu.css";
import { identifierSerializerSeriesIdDataIndex } from "@mui/x-charts/internals";

// displays a single AOI card
function AOIListItem({ aoi, canClickThrough, onNavigateAOI, onCardHover, onCardClick }: {
    aoi: AOISummary;
    canClickThrough?: boolean;
    onNavigateAOI?: (type: SummaryType, id: number) => void;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void
}) {
   const details = convertObjectToAreaSummary(aoi);

    return (
        <Box
            key={aoi.id}
            onMouseEnter={() => onCardHover?.("subarea", aoi.id)}
            onMouseLeave={() => onCardHover?.("subarea", null)}
        >
            <LocationCard
                type="area"
                locationDetails={details}
                onClickCard={() => {onCardClick("area", aoi.id)}}
                onClickSideButton={() => {onNavigateAOI("area", aoi.id)}}
                canClickThrough={canClickThrough}
            />
        </Box>
    );
}

// displays a single subarea card
function subareaListItem({ subarea, canClickThrough, onNavigateSubarea, onCardHover, onCardClick } : {
    subarea : SubAreaSummary
    canClickThrough?: boolean;
    onNavigateSubarea?: (type: SummaryType, id: number) => void;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void;
}) {
   
   const subDetails: SubAreaSummary = convertObjectToSubareaSummary(subarea);
    return (
        <Box
            key={subarea.id}
            onMouseEnter={() => onCardHover?.("subarea", subarea.id)}
            onMouseLeave={() => onCardHover?.("subarea", null)}
        >
            <LocationCard
                type="subarea"
                locationDetails={subDetails}
                onClickCard={() => onCardClick?.("subarea", subarea.id)}
                onClickSideButton={() => onNavigateSubarea?.("subarea", subarea.id)}
                canClickThrough={canClickThrough}
            />
        </Box>
    )
}

// displays a single camera card
function cameraListItem({ camera, canClickThrough, onNavigateCamera, onCardHover, onCardClick } : {
    camera: CameraSummary
    canClickThrough?: boolean;
    onNavigateCamera?: (type: SummaryType, id: number) => void;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void;
}) {
    const cameraDetails: CameraSummary = convertObjectToCameraSummary(camera);
    return (
        <Box
            key={camera.id}
            onMouseEnter={() => onCardHover?.("camera", camera.id)}
            onMouseLeave={() => onCardHover?.("camera", null)}
        >
            <LocationCard
                type="subarea"
                locationDetails={cameraDetails}
                onClickCard={() => {onCardClick?.("camera", camera.id)}}
                onClickSideButton={() => onNavigateCamera?.("camera", camera.id)}
                canClickThrough={canClickThrough}
            />
        </Box>
    )
}

// puts out a percentage as a string value
const pct = (tot: number, n: number) => tot > 0 ? `${((n / tot) * 100).toFixed(1)}%` : "0.0%";

// displays the back button for a menu
function BackButton({onBack, label} : {onBack: () => void, label: string}) {
    return <div className="backButtonContainer">
        <IconButton onClick={onBack}> <ChevronLeftIcon /> </IconButton>
        Back to {label}
    </div>
}





// displays the sidebar for all AOIs
function AllAoiMenu({ aois, listLoading, isDrawingAOI, canClickThrough, onCardHover, onCardClick, canStartDrawing, onStartDrawing, onNavigateAOI } : {
    aois: AOISummary[];
    listLoading: boolean;
    isDrawingAOI?: boolean;
    canClickThrough?: boolean;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void;
    canStartDrawing?: boolean;
    onStartDrawing?: (type: SummaryType, subareaType?: SubAreaType, parentId?: number) => void
    onNavigateAOI?: (type: SummaryType, id: number) => void;
}) {

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <LandingSection
                type="header"
                labelHeader="Areas"
                chipCount={aois.length}

                canAdd
                canStartDrawing={canStartDrawing}
                isAddButtonActive={ isDrawingAOI }
                onClickAdd={() => { onStartDrawing("area"); }}
            >
            
                {listLoading ? (
                    <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                        <CircularProgress size={24} sx={{ color: "#1d1f3f" }} />
                    </Box>
                ) : aois.length === 0 ? (
                    <span className="placeholderText"> You are not monitoring any areas yet. Press the + icon to get started. </span>
                ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                        {aois.map((aoi) => (
                            <AOIListItem
                                key={`aoi-${aoi.id}`}
                                aoi={aoi}
                                canClickThrough={canClickThrough}
                                onNavigateAOI={onNavigateAOI}
                                onCardHover={onCardHover}
                                onCardClick={onCardClick}
                            />
                        ))}
                    </Box>
                )}

            </LandingSection>
        </Box>
    )
}



// displays the sidebar for a selected AOI (name, loc, stats, subareas)
function AoiDetailMenu({ aoi, subareas, detailLoading, canStartDrawing, onStartDrawing, isDrawingSubarea, canClickThrough, onNavigateSubarea, onRenameArea, onDeleteArea, onCardHover, onCardClick, } : {
    aoi: AOISummary;
    subareas: SubAreaSummary[];
    detailLoading?: boolean;
    isDrawingSubarea?: SubAreaType | false;
    canClickThrough?: boolean;
    onNavigateSubarea?: (type: SummaryType, id: number) => void;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void;
    canStartDrawing?: boolean;
    onStartDrawing?: (type: SummaryType, subareaType?: SubAreaType, parentId?: number) => void
    onRenameArea?: (type: SummaryType, id: number) => void;
    onDeleteArea?: (type: SummaryType, id: number) => void;
}) {

    const roadSegments = subareas?.filter((s) => s.sub_area_type === "road_segment") ?? [];
    const intersections = subareas?.filter((s) => s.sub_area_type === "intersection") ?? [];
    const junctions = subareas?.filter((s) => s.sub_area_type === "junction") ?? [];

    return (
        <Box className="menuContainer main">

            { /* title, with edit name functions */ }
            <LandingSection 
                type="title"
                labelHeader={ aoi.name }
                labelSubheader={ aoi.location }
                hasContextMenu
                onClickEditName={() => { onRenameArea("area", aoi.id) }}
                onClickDeleteObject={() => { onDeleteArea("area", aoi.id) }}
            />

            { /* overview – basic statistics */ }
            <LandingSection type="header" labelHeader="Overview" canHide startHidden>
                <LandingSection type="subheader" labelHeader="Total vehicle count">
                    {detailLoading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                            <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                            <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading breakdown...</Typography>
                        </Box>
                    ) : (
                        <AnalyticsCard
                            variant="bar"
                            data={aoi.vehicle_breakdown ?? []}
                            compact
                        />
                    )}
                </LandingSection>

                <LandingSection type="subheader" labelHeader="ADB statistics">
                    { detailLoading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                            <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                            <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading statistics…</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <AnalyticsCard compact headerText="Total ADB" icon={<ReportProblemOutlinedIcon />} variant="text" valueText={aoi.adb.toLocaleString()} />
                            <AnalyticsCard compact headerText="Speeding" icon={<SpeedOutlinedIcon />} variant="text" valueText={`${aoi.speeding} (${pct(aoi.vehicles, aoi.speeding)})`} />
                            <AnalyticsCard compact headerText="Swerving" icon={<SwapCallsIcon />} variant="text" valueText={`${aoi.swerving} (${pct(aoi.vehicles, aoi.swerving)})`} />
                            <AnalyticsCard compact headerText="Abrupt Stop" icon={<PanToolOutlinedIcon />} variant="text" valueText={`${aoi.abrupt_stopping} (${pct(aoi.vehicles, aoi.abrupt_stopping)})`} />
                        </Box>
                    )}
                </LandingSection>
            </LandingSection>

            {/*list down all subareas noted as INTERSECTION */}
            <LandingSection
                type="header"
                labelHeader="Intersections"
                chipCount={intersections.length}
                canHide startHidden

                canAdd
                canStartDrawing={canStartDrawing}
                isAddButtonActive={ isDrawingSubarea === "intersection" }
                onClickAdd={ () => onStartDrawing?.("subarea", "intersection", aoi.id)}
            >
                {intersections.length > 0 ? (
                    intersections.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onCardHover, onCardClick }) })
                ) : (
                    <span className="placeholderText">You are not monitoring any intersections yet. Press the + icon to get started.</span>
                )}
            </LandingSection>

            {/*list down all subareas noted as JUNCTION */}
            <LandingSection
                type="header"
                labelHeader="Junctions"
                chipCount={junctions.length}
                canHide startHidden

                canAdd
                canStartDrawing={canStartDrawing}
                isAddButtonActive={ isDrawingSubarea === "junction" }
                onClickAdd={ () => onStartDrawing?.("subarea", "junction", aoi.id)}
            >
                {junctions.length > 0 ? (
                    junctions.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onCardHover, onCardClick }) })
                ) : (
                    <span className="placeholderText">You are not monitoring any junctions yet. Press the + icon to get started.</span>
                )}
            </LandingSection>

            {/*list down all subareas noted as ROAD SEGMENT */}
            <LandingSection
                type="header"
                labelHeader="Road Segments"
                chipCount={roadSegments.length}
                canHide startHidden

                canAdd
                canStartDrawing={canStartDrawing}
                isAddButtonActive={ isDrawingSubarea === "road_segment" }
                onClickAdd={ () => {onStartDrawing?.("subarea", "road_segment", aoi.id)}}
            >
                {roadSegments.length > 0 ? (
                    roadSegments.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onCardHover, onCardClick }) })
                ) : (
                    <span className="placeholderText">You are not monitoring any road segments yet. Press the + icon to get started.</span>
                )}
            </LandingSection>

        </Box>
    );
}

// displays the sidebar for a certain subarea
function SubareaDetailMenu({ subarea, cameras, detailLoading, onRenameSubarea, onDeleteSubarea, onNavigateCamera, canClickThrough, onCardHover, onCardClick, canStartDrawing, onStartDrawing, isAddingCamera } : {
    subarea: SubAreaSummary,
    cameras: CameraSummary[],
    detailLoading?: boolean,

    canClickThrough?: boolean;
    onCardHover?: (type: SummaryType, id: number | null) => void;
    onCardClick?: (type: SummaryType, id: number) => void;
    onRenameSubarea?: (type: SummaryType, id: number) => void;
    onDeleteSubarea?: (type: SummaryType, id: number) => void;
    onNavigateCamera?: (type: SummaryType, id: number) => void;
    
    canStartDrawing?: boolean;
    onStartDrawing?: (type: SummaryType, subareaType?: SubAreaType, parentId?: number) => void
    isAddingCamera?: boolean;
}) {

    return (
        <Box className="menuContainer main">
            
            { /* title, with edit name functions */ }
            <LandingSection
                type="title"
                labelHeader={ subarea.name }
                
                hasContextMenu
                onClickEditName={() => {onRenameSubarea("subarea", subarea.id)}}
                onClickDeleteObject={() => {onDeleteSubarea("subarea", subarea.id)}}
            />

            { /* overview – basic statistics */ }
            <LandingSection type="header" labelHeader="Overview" canHide startHidden>
                <LandingSection type="subheader" labelHeader="Total vehicle count">
                    {detailLoading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                            <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                            <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading breakdown...</Typography>
                        </Box>
                    ) : (
                        <AnalyticsCard
                            variant="bar"
                            data={subarea.vehicle_breakdown ?? []}
                            compact
                        />
                    )}
                </LandingSection>

                <LandingSection type="subheader" labelHeader="ADB statistics">
                    { detailLoading ? (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                            <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                            <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading statistics…</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                            <AnalyticsCard compact headerText="Total ADB" icon={<ReportProblemOutlinedIcon />} variant="text" valueText={subarea.adb.toLocaleString()} />
                            <AnalyticsCard compact headerText="Speeding" icon={<SpeedOutlinedIcon />} variant="text" valueText={`${subarea.speeding} (${pct(subarea.vehicles, subarea.speeding)})`} />
                            <AnalyticsCard compact headerText="Swerving" icon={<SwapCallsIcon />} variant="text" valueText={`${subarea.swerving} (${pct(subarea.vehicles, subarea.swerving)})`} />
                            <AnalyticsCard compact headerText="Abrupt Stop" icon={<PanToolOutlinedIcon />} variant="text" valueText={`${subarea.abrupt_stopping} (${pct(subarea.vehicles, subarea.abrupt_stopping)})`} />
                        </Box>
                    )}
                </LandingSection>
            </LandingSection>

            { /* for all cameras within this subarea */ }
            <LandingSection
                type="header"
                labelHeader="Cameras"
                chipCount={subarea.camera_count}
                labelSubheader={ subarea.location }
                canHide

                canAdd
                canStartDrawing={canStartDrawing}
                isAddButtonActive={ isAddingCamera ?? false }
                onClickAdd={ () => onStartDrawing?.("camera", null, subarea.id) }
            >
                {(cameras?.length ?? 0) > 0 ? (
                    (cameras ?? []).map((c) => { return cameraListItem({ camera: c, canClickThrough, onNavigateCamera, onCardHover, onCardClick }) })
                ) : (
                    <span className="placeholderText">You do not have any cameras yet for this {subarea.sub_area_type.replaceAll("_", " ")}. Press the + icon to get started.</span>
                )}
            </LandingSection>
        </Box>
    )
}

// displays part of the sidebar for the camera feed tab
function CameraFeedMenu({camera, loadedVideos, videosLoading, thumbnail, onClickUploadVideo, onThumbnailUpdate, onEditCameraTags, onUploadStart, onProcessingStart, onProcessingComplete} : {
    camera: CameraSummary,                                      // summary objecet for this camera
    loadedVideos: VideoSummary[],                               // summary object for all the videos loaded into this camera
    videosLoading?: boolean,                                    // whether videos are still being loaded
    videosError?: boolean,                                      // whether video loading have posted an error
    thumbnail?: string;                                         // the thumbnail to display
    onEditCameraTags?: (id: number, newTags: string[]) => void; // event to trigger when user requests to edit (add or remove) this camera's tags
    onClickUploadVideo?: () => void,                            // event to trigger when user clicks on Upload Video button
    onThumbnailUpdate?: (thumb: string) => void;                // callback when thumbnail updates
    onUploadStart?: (videoName: string) => void;
    onProcessingStart?: (videoName: string, videoId: number) => void;
    onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
}) {
    const [openUploadModal, setOpenUploadModal] = useState(false);

    const handleUploadClick = () => {
        setOpenUploadModal(true);
        onClickUploadVideo?.();  // still notify parent if needed
    };

    return (
        <div className="menuContainer">
            { /* thumbnail */ }
            <div className="thumbnail">
                { videosLoading && ( <CircularProgress size={24} sx={{ color: "#1d1f3f" }} /> ) }
                { !videosLoading && (loadedVideos.length > 0 && (thumbnail == null || thumbnail == "")) && ( <span className="placeholderText">An error occured while loading videos for this camera.</span> ) }
                { !videosLoading && (loadedVideos.length < 1) && <span className="placeholderText">No videos for this area yet. Upload a video to start monitoring.</span> }
                { !videosLoading && (loadedVideos.length > 0 && (thumbnail != null && thumbnail != "")) && ( <img src={thumbnail}></img> ) }
            </div>

            <CameraTags camera={camera} tagLength={camera.tags.length} onEditCameraTags={onEditCameraTags}/>

            <LandingSection type="header"
                labelHeader="Videos"
                chipCount={ !videosLoading ? ( loadedVideos.length ?? 0 ) : (0) }
                canHide

                icon={ <UploadIcon /> }
                onClickIcon={handleUploadClick}
            >
                <VideoTable
                    cameraId={camera.id}
                    camera={camera}
                    loadedVideos={loadedVideos}


                    onVideoFileSelect={(url, thumb) => {
                        if (thumb) onThumbnailUpdate?.(thumb);
                    }}
                    hideUpload={false}
                    externalModalOpen={openUploadModal}
                    onExternalModalClose={() => setOpenUploadModal(false)}
                    onUploadStart={onUploadStart}
                    onProcessingStart={onProcessingStart}
                    onProcessingComplete={onProcessingComplete}
                />     
            </LandingSection>
        </div>
    )
}

// displays part of the sidebar for the camera statistics tab
function CameraStatisticsMenu({camera, loadedVideos, videosLoading, vehicleBreakdown} : {
    camera: CameraSummary,              // summary objecet for this camera
    loadedVideos: VideoSummary[],       // summary object for all the videos loaded into this camera
    videosLoading?: boolean,            // whether videos are still being loaded
    videosError?: boolean,              // whether video loading have posted an error
    vehicleBreakdown: VehicleBreakdown; // breakdown of vehicles by type
}) {
    return (
        <div className="menuContainer">
            <Timeline cameraIds={[camera.id]} />

             { /* overview – basic statistics */ }
            {/* <LandingSection type="header" labelHeader="Overview" canHide> */}
                <LandingSection type="header" labelHeader="Total vehicle count" canHide>
                    <AnalyticsCard
                        variant="bar"
                        data={vehicleBreakdown ?? []}
                        compact
                    />
                </LandingSection>
            {/* </LandingSection> */}

        </div>
    )
}

// displays the sidebar for a certain camera
function CameraDetailMenu({
    camera, videos, videosLoading,
    onFeedTabActive, onRenameCamera, onRecalibrateCamera, onDeleteCamera, onEditCameraTags,
    onClickUploadVideo, onUploadStart, onProcessingStart, onProcessingComplete
} : {
    camera: CameraSummary,                                                              // summary object for this camera
    videos: VideoSummary[],                                                             // array of all videos that this camera has
    videosLoading: boolean,                                                             // whether videos are still loading; displays a loading graphic over menu
    onFeedTabActive?: (active: boolean) => void;                                        // event to trigger when user enters the feed tab
    onRenameCamera?: (type: SummaryType, id: number) => void;                           // event to trigger when user requests to rename this camera
    onRecalibrateCamera?: (id: number) => void;                                         // event to trigger when user requests to delete this camera
    onDeleteCamera?: (type: SummaryType, id: number) => void;                           // event to trigger when user requests to delete this camera
    onEditCameraTags?: (id: number, newTags: string[]) => void;                         // event to trigger when user requests to edit (add or remove) this camera's tags
    onClickUploadVideo?: (id: number) => void;                                          // event to trigger when user requests to upload a video
    onUploadStart?: (videoName: string) => void;                                        
    onProcessingStart?: (videoName: string, videoId: number) => void;
    onProcessingComplete?: (videoName: string, success: boolean, data?: any) => void;
}) {

    // state variables
    const [thumbnail, setThumbnail] = useState<string | null>(camera.thumbnail)
    const [activeTab, setActiveTab] = useState<"feed" | "statistics">("feed")

    // toggles the tab
    const handleToggleTab = (newMode: "feed" | "statistics") => {
        setActiveTab(newMode);
        onFeedTabActive?.(newMode === "feed");
    }

    // display page here
    return (
        <Box className="menuContainer main">

            { /* title, with edit name functions */ }
            <LandingSection
                type="title"
                labelHeader={ camera.name }
                labelSubheader={ camera.location }
                
                hasContextMenu
                onClickEditName={() => {onRenameCamera("camera", camera.id)}}
                onClickRecalibratePolygons={() => {onRecalibrateCamera(camera.id)}}
                onClickDeleteObject={() => {onDeleteCamera("camera", camera.id)}}
            />

            { /* mode toggle between feed and statistics */ }
            <ModeSegmentedControl currentMode={activeTab} onClick={handleToggleTab} />

            {activeTab == "feed" && (<CameraFeedMenu
                camera={camera} 
                loadedVideos={videos}
                videosLoading={videosLoading}
                thumbnail={thumbnail}
                onClickUploadVideo={() => {onClickUploadVideo(camera.id)}}
                onThumbnailUpdate={(thumb) => setThumbnail(thumb)}
                onEditCameraTags={onEditCameraTags}
                onUploadStart={onUploadStart}
                onProcessingStart={onProcessingStart}
                onProcessingComplete={onProcessingComplete}
            />)}

            {activeTab == "statistics" && (<CameraStatisticsMenu
                camera={camera} loadedVideos={videos}
                videosLoading={videosLoading}
                vehicleBreakdown={camera.vehicle_breakdown}
            />)}
        </Box>
    )
}






// definition of types for the props for MenuBar
interface SideMenuProps {

    locationSummariesLoading?: boolean;                                                         // has our parent page finished loading all the location summaries?
    videosLoading?: boolean;                                                                    // has our parent page finished loading all the videos?

    allAois?: AOIRecord;                                                                        // all AOIs visible to this side menu
    allSubareas?: SubareaRecord;                                                                // all subareas visible to this side menu
    allCameras?: CameraRecord;                                                                  // all cameras visible to this side menu
    allVideos?: VideoRecord;                                                                    // all videos visible to this side menu

    selectedAOI?: AOISummary | null;                                                            // currently selected AOI
    selectedSubarea?: SubAreaSummary | null;                                                    // currently selected subarea
    selectedCamera?: CameraSummary | null;                                                      // currently selected camera
    currentSelectionMode?: "all" | SummaryType;                                                 // the current active "selection mode" (all aoi/home, aoi, subarea, camera)

    canClickToAreas?: boolean;                                                                  // whether the user can click to areas or not (area cards will have loading icons if not)
    canClickToSubareas?: boolean;                                                               // whether the user can click to subareas or not (subarea cards will have loading icons if not)
    canClickToCameras?: boolean;                                                                // whether the user can click to cameras or not (camera cards will have loading icons if not)
    isDrawingAOI?: boolean;                                                                     // true while the user is drawing an AOI on the map
    isDrawingSubarea?: SubAreaType | false;                                                     // which sub-area type is currently being drawn, false if not drawing subarea
    isDrawingCamera?: boolean;                                                                  // true while the user is creating a camera on the map

    canStartDrawing?: boolean;                                                                  // whether the user can click on the draw (add area/subarea/camera) buttons
    onNavigateTo?: (type: SummaryType, id: number) => void;                                     // called with object id on selecting an object
    onCardClick?: (type: SummaryType, id: number) => void;                                      // on click card --> leads to having that highlighted with options on the map
    onCardHover?: (type: SummaryType, id: number | null) => void;                               // on hover on map
    onStartDrawing?: (type: SummaryType, subareaType?: SubAreaType, parentId?: number) => void  // called when user requests to start drawing
    onRequestRename?: (type: SummaryType, id: number) => void;                                  // called when user requests to rename an object (area/subarea/camera)
    onRequestDelete?: (type: SummaryType, id: number) => void;                                  // called when user requests to delete an object (area/subarea/camera)
    onBack?: () => void;                                                                        // called when returning from a previous menu
    
    onEditCameraTags?: (id: number, newTags: string[]) => void;                                 // event to trigger when user requests to edit (add or remove) a camera's tags
    onCameraUpload?: (id: number) => void;                                                      // triggers when user clicks to upload a new video for a camera
    onRecalibrateCamera?: (id: number) => void;                                                 // triggers when user clicks to recalibrate a camera

    onFeedTabActive?: (active: boolean) => void;                                                // called when the feed tab of a camera is active
}

// creates a Landing Page side menu gui and handles its data operations
export default function SideMenu({
    locationSummariesLoading = true, videosLoading = true,
    canClickToAreas = true, isDrawingAOI = false,
    canClickToSubareas = true, isDrawingSubarea = false,
    canClickToCameras = true, onCameraUpload, onRecalibrateCamera, isDrawingCamera, onEditCameraTags,
    onFeedTabActive,
    canStartDrawing = true, allAois, allSubareas, allCameras, allVideos, selectedAOI, selectedSubarea, selectedCamera, currentSelectionMode,
    onNavigateTo, onBack, onCardClick, onCardHover, onStartDrawing, onRequestRename, onRequestDelete,
}: SideMenuProps) {
    const router = useRouter();
    const { trackVideoProcessing, showToast } = useNotifications();
    const scrollRef = useRef<HTMLDivElement>(null);

    // handles the sign out process - removes user session data from the browser
    const handleSignOut = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");
        router.push("/logIn");
    };

    const debugButtons = true
    return (
        <Box className={styles.menuContainer}>
            { /* the header – include title and signout */ }
            <Box className={styles.menuHeader}>
                <Typography variant="h3" className={styles.brakePoint}>BrakePoint</Typography>
                <Button
                    onClick={handleSignOut}
                    // onClick={ () => {console.log(aois)} }
                    sx={{
                        marginLeft: '9em',
                        minWidth: 0,
                        padding: '5px 20px 5px 20px',
                        color: 'rgb(236, 237, 245)',
                        cursor: 'pointer',
                        "&:hover": { bgcolor: "rgb(236, 237, 245)", color: "#161b4c" },
                    }}
                >
                    <LogoutIcon sx={{ fontSize: '1.8rem' }} />
                </Button>
            </Box>


            { /* program contents */ }
            <Box
                ref={scrollRef}
                sx={{
                    width: "100%", mt: "1em", flex: 1, overflowY: "auto", paddingBottom: "2em",
                    "&::-webkit-scrollbar": { width: 4 },
                    "&::-webkit-scrollbar-thumb": { bgcolor: "#c5c7d8", borderRadius: 4 },
                }}
            >
                { locationSummariesLoading ? ( <>
                    <div className="loadingContainer">
                        <CircularProgress size={24} sx={{ color: "#1d1f3f"  }} />
                        <span className="placeholderText"> Loading data... </span>
                    </div>
                </> ) : ( <> 

                    {/* back button */}
                    {(selectedCamera || selectedSubarea || selectedAOI) && (
                        <BackButton onBack={onBack} label={
                            selectedCamera ? selectedSubarea.name : selectedSubarea ? selectedAOI.name : "all AOIs"
                        }
                    />
                    )}

                    { /* DEBUG OPTIONS — DISABLE debugButtons WHEN NOT BEING USED */ }
                    { debugButtons && ( <div className="backButtonContainer" style={{fontFamily: "50%"}}>
                        <Button variant="outlined" onClick={() => { console.log(allAois) }}> AOIs </Button>
                        <Button variant="outlined" onClick={() => { console.log(allSubareas) }}> Subareas </Button>
                        <Button variant="outlined" onClick={() => { console.log(allCameras) }}> Cameras </Button>
                        <Button variant="outlined" onClick={() => { console.log(allVideos) }}> Videos </Button>
                        <Button variant="outlined" onClick={() => { console.log(locationSummariesLoading, videosLoading) }}> Loadings? </Button>
                    </div>)}


                    {currentSelectionMode === "camera" && (
                        <CameraDetailMenu
                            camera={selectedCamera}
                            videos={convertRecordToArray(allVideos).filter((x) => x.camera === selectedCamera.id)}
                            videosLoading={videosLoading}
                            onRenameCamera={onRequestRename}
                            onRecalibrateCamera={onRecalibrateCamera}
                            onDeleteCamera={onRequestDelete}
                            onEditCameraTags={onEditCameraTags}
                            onClickUploadVideo={onCameraUpload}
                            onFeedTabActive={onFeedTabActive}

                            onUploadStart={(videoName) => showToast(`Uploading "${videoName}"…`, "info")}
                            
                            onProcessingStart={(videoName, videoId) => {
                                showToast(`"${videoName}" uploaded — processing started`, "info");
                                trackVideoProcessing(videoName, videoId);
                            }}
                            onProcessingComplete={(videoName, success, data) => {
                                showToast(
                                    success ? `"${videoName}" processed successfully` : `"${videoName}" — ${data?.error || "Processing failed"}`,
                                    success ? "success" : "error"
                                );
                            }}
                            
                        />
                    )}
                    
                    { currentSelectionMode === "subarea" && (
                        <SubareaDetailMenu
                            subarea={selectedSubarea}
                            cameras={convertRecordToArray(allCameras).filter((x) => x.parent === selectedSubarea.id)}
                            detailLoading={false}
                            canStartDrawing={canStartDrawing}
                            onStartDrawing={onStartDrawing}
                            onRenameSubarea={onRequestRename}
                            onDeleteSubarea={onRequestDelete}
                            canClickThrough={canClickToCameras}
                            onNavigateCamera={onNavigateTo}
                            onCardClick={onCardClick}
                            onCardHover={onCardHover}
                            isAddingCamera={isDrawingCamera}
                        />
                    )}

                    { currentSelectionMode === "area" && (
                        // AOI detail – if an AOI is currently selected
                        <AoiDetailMenu
                            aoi={selectedAOI}
                            subareas={convertRecordToArray(allSubareas).filter((x) => x.parent === selectedAOI.id)}
                            detailLoading={false}
                            isDrawingSubarea={isDrawingSubarea}
                            canClickThrough={canClickToSubareas}
                            onCardHover={onCardHover}
                            onCardClick={onCardClick}
                            canStartDrawing={canStartDrawing}
                            onStartDrawing={onStartDrawing}
                            onRenameArea={onRequestRename}
                            onDeleteArea={onRequestDelete}
                            onNavigateSubarea={onNavigateTo}
                        />
                    )}

                    { currentSelectionMode === "all" && (
                        // main menu – list of all AOIs
                        // Panel 1: AOI list
                        <AllAoiMenu
                            aois = {convertRecordToArray(allAois)}
                            listLoading = {locationSummariesLoading}
                            isDrawingAOI = {isDrawingAOI}
                            canClickThrough={canClickToAreas}
                            onCardHover = {onCardHover}
                            onCardClick = {onCardClick}
                            onNavigateAOI = {onNavigateTo} 
                            canStartDrawing={canStartDrawing}
                            onStartDrawing={onStartDrawing}
                        />
                    )}
                </> )}

            </Box>
        </Box>
    );
}