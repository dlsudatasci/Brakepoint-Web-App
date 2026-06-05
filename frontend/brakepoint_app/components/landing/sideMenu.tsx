"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Chip, CircularProgress, Divider, IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import styles from "./menuBar.module.css";
import { authFetch } from "@/lib/authFetch";

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
} from "@/components/landing/summaryTypes";
import CameraTags from "@/components/ui/cameraTags";

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

// displays a single AOI card
function AOIListItem({ aoi, canClickThrough, onClick, onEditClick }: {
    aoi: AOISummary;
    canClickThrough?: boolean;
    onClick: () => void;
    onEditClick?: () => void
}) {
   const details = convertObjectToAreaSummary(aoi);

    return (
        <Box>
            <LocationCard
                type="area"
                locationDetails={details}
                onClickCard={onEditClick ?? (() => {})}
                onClickSideButton={onClick}
                canClickThrough={canClickThrough}
            />
        </Box>
    );
}

// displays a single subarea card
function subareaListItem({ subarea, canClickThrough, onNavigateSubarea, onSubareaHover, onSubareaClick } : {
    subarea : SubAreaSummary
    canClickThrough?: boolean;
    onNavigateSubarea?: (sub: SubAreaSummary) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {
   
   const subDetails: SubAreaSummary = convertObjectToSubareaSummary(subarea);
    return (
        <Box
            key={subarea.id}
            onMouseEnter={() => onSubareaHover?.(subarea.id)}
            onMouseLeave={() => onSubareaHover?.(null)}
        >
            <LocationCard
                type="subarea"
                locationDetails={subDetails}
                onClickCard={() => onSubareaClick?.(subarea.id, subarea.name)}
                onClickSideButton={() => onNavigateSubarea?.(subarea)}
                canClickThrough={canClickThrough}
            />
        </Box>
    )
}

// displays a single camera card
function cameraListItem({ camera, canClickThrough, onNavigateCamera, onCameraHover, onCameraClick } : {
    camera: CameraSummary
    canClickThrough?: boolean;
    onNavigateCamera?: (sub: CameraSummary) => void;
    onCameraHover?: (id: number | null) => void;
    onCameraClick?: (id: number, name: string) => void;
}) {
    const cameraDetails: CameraSummary = convertObjectToCameraSummary(camera);
    return (
        <Box
            key={camera.id}
            onMouseEnter={() => onCameraHover?.(camera.id)}
            onMouseLeave={() => onCameraHover?.(null)}
        >
            <LocationCard
                type="subarea"
                locationDetails={cameraDetails}
                onClickCard={() => {}}
                onClickSideButton={() => onNavigateCamera?.(camera)}
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
function AllAoiMenu({ aois, listLoading, isDrawingAOI, canClickThrough, onAoiHover, onAoiClick, handleAddArea, handleSelectAOI } : {
    aois: AOISummary[];
    listLoading: boolean;
    isDrawingAOI?: boolean;
    canClickThrough?: boolean;
    onAoiHover?: (id: number | null) => void;
    onAoiClick?: (id: number) => void;
    handleAddArea?: () => void;
    handleSelectAOI?: (aoi: AOISummary) => void;
}) {

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <LandingSection
                type="header"
                labelHeader="Areas"
                chipCount={aois.length}

                canAdd
                isAddButtonActive={ isDrawingAOI }
                onActivateAdd={() => { handleAddArea(); }}
                onDeactivateAdd={() => { handleAddArea(); }}
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
                            <Box
                                key={aoi.id}
                                onMouseEnter={() => onAoiHover?.(aoi.id)}
                                onMouseLeave={() => onAoiHover?.(null)}
                            >
                                <AOIListItem aoi={aoi} canClickThrough={canClickThrough} onClick={() => handleSelectAOI(aoi)} onEditClick={() => onAoiClick?.(aoi.id)} />
                            </Box>
                        ))}
                    </Box>
                )}

            </LandingSection>
        </Box>
    )
}



// displays the sidebar for a selected AOI (name, loc, stats, subareas)
function AoiDetailMenu({ aoi, detailLoading, onBack, onAddSubarea, isDrawingSubarea, canClickThrough, onNavigateSubarea, onRenameArea, onDeleteArea, onSubareaHover, onSubareaClick, } : {
    aoi: AOISummary;
    detailLoading?: boolean;
    onBack: () => void;
    onAddSubarea?: (type: SubAreaType) => void;
    isDrawingSubarea?: SubAreaType | false;
    canClickThrough?: boolean;
    onNavigateSubarea?: (sub: SubAreaSummary) => void;
    onRenameArea?: (id: number) => void;
    onDeleteArea?: (id: number) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {

    const roadSegments = aoi.subareas?.filter((s) => s.sub_area_type === "road_segment") ?? [];
    const intersections = aoi.subareas?.filter((s) => s.sub_area_type === "intersection") ?? [];
    const junctions = aoi.subareas?.filter((s) => s.sub_area_type === "junction") ?? [];

    return (
        <Box className="menuContainer main">
            {/* back button */}
            <BackButton onBack={onBack} label="all areas"/>

            { /* title, with edit name functions */ }
            <LandingSection 
                type="title"
                labelHeader={ aoi.name }
                labelSubheader={ aoi.location }
                hasContextMenu
                onClickEditName={() => { onRenameArea(aoi.id) }}
                onClickDeleteObject={() => { onDeleteArea(aoi.id) }}
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
                isAddButtonActive={ isDrawingSubarea === "intersection" }
                onActivateAdd={ () => onAddSubarea?.("intersection")}
                onDeactivateAdd={ () => onAddSubarea?.("intersection")}
            >
                {intersections.length > 0 ? (
                    intersections.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
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
                isAddButtonActive={ isDrawingSubarea === "junction" }
                onActivateAdd={ () => onAddSubarea?.("junction")}
                onDeactivateAdd={ () => onAddSubarea?.("junction")}
            >
                {junctions.length > 0 ? (
                    junctions.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
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
                isAddButtonActive={ isDrawingSubarea === "road_segment" }
                onActivateAdd={ () => {onAddSubarea?.("road_segment")}}
                onDeactivateAdd={ () => {onAddSubarea?.("road_segment")}}
            >
                {roadSegments.length > 0 ? (
                    roadSegments.map((sub) => { return subareaListItem({ subarea: sub, canClickThrough, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
                ) : (
                    <span className="placeholderText">You are not monitoring any road segments yet. Press the + icon to get started.</span>
                )}
            </LandingSection>

        </Box>
    );
}

// displays the sidebar for a certain subarea
function SubareaDetailMenu({ subarea, detailLoading, onBack, onRenameSubarea, onDeleteSubarea, onNavigateCamera, canClickThrough, onCameraHover, onCameraClick, parentName, onAddCamera, isAddingCamera } : {
    subarea: SubAreaSummary,
    detailLoading?: boolean,
    onBack: () => void;

    onRenameSubarea?: (id: number) => void;
    onDeleteSubarea?: (id: number) => void;
    onNavigateCamera?: (camera: CameraSummary) => void;
    canClickThrough?: boolean;
    onCameraHover?: (id: number | null) => void;
    onCameraClick?: (id: number, name: string) => void;

    parentName: string,
    onAddCamera?: () => void;
    isAddingCamera?: boolean;
}) {

    return (
        <Box className="menuContainer main">
            {/* back button */}
            <BackButton onBack={onBack} label={parentName}/>
            
            { /* title, with edit name functions */ }
            <LandingSection
                type="title"
                labelHeader={ subarea.name }
                
                hasContextMenu
                onClickEditName={() => {onRenameSubarea(subarea.id)}}
                onClickDeleteObject={() => {onDeleteSubarea(subarea.id)}}
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
                isAddButtonActive={ isAddingCamera ?? false }
                onActivateAdd={ () => onAddCamera?.() }
                onDeactivateAdd={ () => onAddCamera?.() }
            >
                {(subarea.cameras?.length ?? 0) > 0 ? (
                    (subarea.cameras ?? []).map((c) => { return cameraListItem({ camera: c, canClickThrough, onNavigateCamera, onCameraClick, onCameraHover }) })
                ) : (
                    <span className="placeholderText">You do not have any cameras yet for this {subarea.sub_area_type.replaceAll("_", " ")}. Press the + icon to get started.</span>
                )}
            </LandingSection>
        </Box>
    )
}

// displays part of the sidebar for the camera feed tab
function CameraFeedMenu({camera, loadedVideos, videosError, videosLoading, thumbnail, onClickUploadVideo} : {
    camera: CameraSummary,              // summary objecet for this camera
    loadedVideos: VideoSummary[],       // summary object for all the videos loaded into this camera
    videosLoading?: boolean,            // whether videos are still being loaded
    videosError?: boolean,              // whether video loading have posted an error
    thumbnail?: string;                 // the thumbnail to display
    onClickUploadVideo?: () => void,    // event to trigger when user clicks on Upload Video button
}) {
    return (
        <div className="menuContainer">
            { /* thumbnail */ }
            <div className="thumbnail">
                { videosError && ( <span className="placeholderText">An error occured while loading videos for this camera.</span> ) }
                { !videosError && videosLoading && ( <CircularProgress size={24} sx={{ color: "#1d1f3f" }} /> ) }
                { !videosError && !videosLoading && (loadedVideos.length > 0 && (thumbnail == undefined || thumbnail == "")) && ( <span className="placeholderText">An error occured while loading videos for this camera.</span> ) }
                { !videosError && !videosLoading && (loadedVideos.length < 1) && <span className="placeholderText">No videos for this area yet. Upload a video to start monitoring.</span> }
                { !videosError && !videosLoading && (loadedVideos.length > 0 && (thumbnail != undefined && thumbnail != "")) && ( <img src={thumbnail}></img> ) }
            </div>

            <CameraTags cameraId={camera.id} />

            <LandingSection type="header"
                labelHeader="Videos"
                chipCount={ !videosLoading && !videosError ? ( loadedVideos.length ?? 0 ) : (0) }
                canHide

                icon={ <UploadIcon /> }
                onClickIcon={ onClickUploadVideo }
            >
                { /* TODO video table */ }            
            </LandingSection>
        </div>
    )
}

// displays part of the sidebar for the camera statistics tab
function CameraStatisticsMenu({camera, loadedVideos, videosError, videosLoading} : {
    camera: CameraSummary,              // summary objecet for this camera
    loadedVideos: VideoSummary[],       // summary object for all the videos loaded into this camera
    videosLoading?: boolean,            // whether videos are still being loaded
    videosError?: boolean,              // whether video loading have posted an error
}) {
    return (
        <div className="menuContainer">
            <Timeline cameraIds={[camera.id]} />
        </div>
    )
}

// displays the sidebar for a certain camera
function CameraDetailMenu({camera, detailLoading, onBack, parentName, onClickUploadVideo, onFeedTabActive, onRenameCamera, onRecalibrateCamera, onDeleteCamera} : {
    camera: CameraSummary,
    detailLoading?: boolean,
    onBack: () => void;
    parentName: string;
    onClickUploadVideo?: (id: number) => void;
    onFeedTabActive?: (active: boolean) => void;
    onRenameCamera?: (id: number) => void;
    onRecalibrateCamera?: (id: number) => void;
    onDeleteCamera?: (id: number) => void;
}) {
    const [videosLoading, setVideosLoading] = useState<boolean>(true);
    const [videosError, setVideosError] = useState<boolean>(false);
    const [loadedVideos, setLoadedVideos] = useState<VideoSummary[]>()
    const [thumbnail, setThumbnail] = useState<string | undefined>(undefined)
    const [activeTab, setActiveTab] = useState<"feed" | "statistics">("feed")
    
    // get a video from the api
    useEffect(() => {
        const fetchVideos = async () => {
            try {
                const response = await authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras/${camera.id}/videos/`);
                if (!response.ok) { setVideosLoading(false); setVideosError(true); } // quickfail
                const data = await response.json();

                // convert everything to a VideoSummary
                const allVideos: VideoSummary[] = data.videos
                    .map((v) => ( convertObjectToVideoSummary(v) ))
                    .sort((a: VideoSummary, b: VideoSummary) => { a.uploaded_at < b.uploaded_at ? 1 : a.uploaded_at > b.uploaded_at ? -1 : 0  });

                // process the data here
                // ...

                // set our data
                setLoadedVideos(allVideos);
                setThumbnail(allVideos.length > 0 ? allVideos[0].thumbnail : "");
                setVideosLoading(false);
            } catch(e) {
                // error handler — notify immediately and clean up
                setVideosLoading(false);
                setVideosError(true);
            }
        }

        fetchVideos();
    }, [camera])

    // toggles the tab
    const handleToggleTab = (newMode: "feed" | "statistics") => {
        setActiveTab(newMode);
        onFeedTabActive?.(newMode === "feed");
    }

    // display page here
    return (
        <Box className="menuContainer main">
            {/* back button */}
            <BackButton onBack={onBack} label={parentName}/>

            { /* title, with edit name functions */ }
            <LandingSection
                type="title"
                labelHeader={ camera.name }
                labelSubheader={ camera.location }
                
                hasContextMenu
                onClickEditName={() => {onRenameCamera(camera.id)}}
                onClickRecalibratePolygons={() => {onRecalibrateCamera(camera.id)}}
                onClickDeleteObject={() => {onDeleteCamera(camera.id)}}
            />

            { /* mode toggle between feed and statistics */ }
            <ModeSegmentedControl currentMode={activeTab} onClick={handleToggleTab} />

            {activeTab == "feed" && (<CameraFeedMenu
                camera={camera} loadedVideos={loadedVideos}
                videosLoading={videosLoading} videosError={videosError} thumbnail={thumbnail}
                onClickUploadVideo={() => {onClickUploadVideo(camera.id)}}
            />)}

            {activeTab == "statistics" && (<CameraStatisticsMenu
                camera={camera} loadedVideos={loadedVideos}
                videosLoading={videosLoading} videosError={videosError}
            />)}
        </Box>
    )
}






// use this type to call functions to quickly update data in the side menu
export type SideMenuUpdater = {
    setLoading: (newSetting: boolean) => void;                              // sets whether listLoading is active to denote that the system is busy loading currently
    renameObject: (type: SummaryType, id: number, newName: string) => void; // renames an object (area/subarea/camera) to a new name
    deleteObject: (type: SummaryType, id: number) => void;                  // deletes an object (area/subarea/camera)
    createObject: (obj: LocationSummary, parentId?: number) => void;        // creates a new object (area/subarea/camera) from the given data
    addCamera: (camera: CameraSummary, subareaId: number) => void;          // adds a camera to a subarea in local state
    selectCamera: (cameraId: number | string) => void;                      // navigates to a camera detail view by id
};

// definition of types for the props for MenuBar
interface SideMenuProps {
    refreshTrigger?: number;                                // increment to re-fetch the AOI list
    onMount?: (updater: SideMenuUpdater) => void;           // provides direct update fns to avoid full refetch on edit/delete

    canClickToAreas?: boolean;                              // whether the user can click to areas or not (area cards will have loading icons if not)
    onAoiHover?: (id: number | null) => void;               // called with AOI id on hover, null on leave
    onAoiClick?: (id: number) => void;                      // called when an AOI card is clicked — opens edit/delete dialog
    onAoiEnter?: (aoi: AOISummary) => void;                 // called when the arrow button is clicked — zooms map to AOI
    onAoiBack?: () => void;                                 // called when the user navigates back from an AOI detail view
    onRenameAoi?: (id: number) => void;                     // triggers when user clicks to rename an area;
    onDeleteAoi?: (id: number) => void;                     // triggers when user clicks to delete an area;
    onAddArea?: () => void;                                 // triggers when the user clicks the "add area" button
    isDrawingAOI?: boolean;                                 // true while the user is drawing an AOI on the map

    canClickToSubareas?: boolean;                              // whether the user can click to areas or not (area cards will have loading icons if not)
    onSelectSubarea?: (subareaId: number, cameraIds: number[]) => void;          // triggers when the user selects a subarea
    onSubareaHover?: (id: number | null) => void;           // called with sub-area id on hover, null on leave
    onSubareaClick?: (id: number, name: string) => void;    // called when a road segment card body is clicked — opens edit/delete dialog
    onRenameSubarea?: (id: number) => void;                 // triggers when user clicks to rename a subarea;
    onDeleteSubarea?: (id: number) => void;                 // triggers when user clicks to delete a subarea;
    onAddSubarea?: (type: SubAreaType) => void;             // called when + in any segment section is clicked
    isDrawingSubarea?: SubAreaType | false;                 // which sub-area type is currently being drawn

    onSubareaBack?: () => void;                             // called when the user navigates back from a subarea detail view

    canClickToCameras?: boolean;                            // whether the user can click to cameras or not (area cards will have loading icons if not)
    onCameraClick?: (id: number) => void;                   // called when a camera card is clicked — opens edit/delete dialog
    onCameraEnter?: (camera: CameraSummary) => void;        // called when the arrow button is clicked — selects and enters the submenu of this camera
    onCameraBack?: () => void;                              // called when the user navigates back from a camera detail view
    onCameraUpload?: (id: number) => void;                  // triggers when user clicks to upload a new video for a camera
    onRenameCamera?: (id: number) => void;                  // triggers when user clicks to rename a camera
    onRecalibrateCamera?: (id: number) => void;             // triggers when user clicks to recalibrate a camera
    onDeleteCamera?: (id: number) => void;                  // triggers when user clicks to delete a camera
    onAddCamera?: () => void;                               // called when + in the camera section is clicked
    isDrawingCamera?: boolean;                              // rue while the user is creating a camera on the map

    onFeedTabActive?: (active: boolean) => void;              // called when the feed tab of a camera is active
}

// creates a Landing Page side menu gui and handles its data operations
export default function SideMenu({
    canClickToAreas = true, onAoiHover, onAoiClick, onAoiEnter, onAoiBack, onAddArea, onRenameAoi, onDeleteAoi, isDrawingAOI = false,
    canClickToSubareas = true, onSelectSubarea, onSubareaHover, onSubareaClick, onSubareaBack, onAddSubarea, onRenameSubarea, onDeleteSubarea, isDrawingSubarea = false,
    canClickToCameras = true, onCameraClick, onCameraEnter, onCameraBack, onAddCamera, onCameraUpload, onRenameCamera, onRecalibrateCamera, onDeleteCamera, isDrawingCamera,
    onFeedTabActive,
    onMount, refreshTrigger, 
    // onAddArea, onSelectSubarea, refreshTrigger, isDrawingAOI = false, onAoiHover, onAoiClick, onAoiEnter, onAoiBack, onAddSubarea, isDrawingSubarea = false, onSubareaHover, onSubareaClick, onMount
}: SideMenuProps) {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);
    // list of all AOIs; ontaining a list of all subareas and cameras by parent
    const [aois, setAois] = useState<AOISummary[]>([]);

    // selections for AOI, subarea, and camera
    const [selectedAOI, setSelectedAOI] = useState<AOISummary | null>(null);
    const selectedAOIRef = useRef<AOISummary | null>(null);
    selectedAOIRef.current = selectedAOI;
    
    const [selectedSubarea, setSelectedSubarea] = useState<SubAreaSummary | null>(null)
    const selectedSubareaRef = useRef<SubAreaSummary | null>(null)
    selectedSubareaRef.current = selectedSubarea;

    const [selectedCamera, setSelectedCamera] = useState<CameraSummary | null>(null);
    const selectedCameraRef = useRef<CameraSummary | null>(null);
    selectedCameraRef.current = selectedCamera;

    const onCameraEnterRef = useRef(onCameraEnter);
    onCameraEnterRef.current = onCameraEnter;

    // whether the page is loading
    const [detailLoading, setDetailLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);



    // scans where an object may be and returns given its id
    // starts all searches in the current selection (if any) and then loops through everything else
    function getObjectAndParentsFromId(ofType: SummaryType, idToFind: number): {area?: AOISummary, subarea?: SubAreaSummary, camera?: CameraSummary} | null {
        if (ofType == "area") {
            if (selectedAOI && selectedAOI.id === idToFind) { return { area: selectedAOI } }
            else {
                const res =  aois.find((a) => a.id === idToFind) ?? null
                if (res) return { area: res }
            }
        } else if (ofType == "subarea") {
            if (selectedSubarea && selectedSubarea.id === idToFind) { return { area: selectedAOI, subarea: selectedSubarea } }
            if (selectedAOI && selectedAOI.subareas != undefined) {
                const res = selectedAOI.subareas.find((s) => s.id === idToFind);
                if (res) return { area: selectedAOI, subarea: res };
            }
            for (const a of aois) {
                if (selectedAOI && a.id == selectedAOI.id) continue; // skip current, already scanned this
                const res = a.subareas.find((s) => s.id === idToFind);
                if (res) return { area: a, subarea: res };
            }
            return null;
        } else if (ofType == "camera") {
            if (selectedCamera && selectedCamera.id === idToFind) { return { area: selectedAOI, subarea: selectedSubarea, camera: selectedCamera } }
            else if (selectedSubarea && selectedSubarea.cameras != undefined) {
                const res = selectedSubarea.cameras.find((c) => c.id === idToFind);
                if (res) return { area: selectedAOI, subarea: selectedSubarea, camera: res };
            }
            else if (selectedAOI && selectedAOI.subareas != undefined) {
                for (const s of selectedAOI.subareas) {
                    if (!s.cameras) continue;
                    if (selectedSubarea && s.id == selectedSubarea.id) continue; // skip current, already scanned this
                    const res = s.cameras.find((c) => c.id === idToFind);
                    if (res) return { area: selectedAOI, subarea: s, camera: res };
                }
            }
            for (const a of aois) {
                if (!a.subareas) continue;
                if (selectedAOI && a.id == selectedAOI.id) continue; // skip current, already scanned this
                for (const s of a.subareas) {
                    if (!s.cameras) continue;
                    const res = s.cameras.find((c) => c.id === idToFind)
                    if (res) return { area: a, subarea: s, camera: res };
                }
            }
            return null;
        }
    }

    // above function but only returns a single object
    function getObjectFromId(ofType: SummaryType, idToFind: number): LocationSummary | null {
        const res = getObjectAndParentsFromId(ofType, idToFind)
        switch (ofType) {
            case "area": return (res.area as LocationSummary) ?? null;
            case "subarea": return (res.subarea as LocationSummary) ?? null;
            case "camera": return (res.camera as LocationSummary) ?? null;
        }
    }

    function getObjectPathTraceFromId(ofType: SummaryType, idToFind: number): {area: number | null, subarea: number | null, camera: number | null} {
        const res = getObjectAndParentsFromId(ofType, idToFind);
        return {
            area: (res.area ? res.area.id : null),
            subarea: (res.subarea ? res.subarea.id : null),
            camera: (res.camera ? res.camera.id : null)
        }
    }

    // aliases of the above function for specific types
    function getAreaFromId(idToFind: number): AOISummary | null { return getObjectFromId("area", idToFind) as AOISummary };
    function getSubareaFromId(idToFind: number): SubAreaSummary | null { return getObjectFromId("subarea", idToFind) as SubAreaSummary };
    function getCameraFromId(idToFind: number): CameraSummary | null { return getObjectFromId("camera", idToFind) as CameraSummary };

    // update area, subarea, and camera selections to latest
    function updateSelections(thisAoi?: AOISummary[]) {
        if (thisAoi == undefined) { thisAoi = aois }
        let newSelectedAoi: AOISummary = null;
        let newSelectedSubarea: SubAreaSummary = null;
        let newSelectedCamera: CameraSummary = null;

        // updating AOI
        if (selectedAOI) {
            newSelectedAoi = thisAoi.find((a) => a.id === selectedAOI.id) ?? null
        }

        // updating subarea
        if (selectedSubarea && newSelectedAoi && newSelectedAoi.subareas) {
            newSelectedSubarea = newSelectedAoi.subareas.find((s) => s.id === selectedSubarea.id) ?? null
        }

        // updating camera
        if (selectedCamera && newSelectedSubarea && newSelectedSubarea.cameras) {
            newSelectedCamera = newSelectedSubarea.cameras.find((c) => c.id === selectedCamera.id) ?? null
        }
        
        setSelectedAOI(newSelectedAoi);
        setSelectedSubarea(newSelectedSubarea);
        setSelectedCamera(newSelectedCamera);
        setListLoading(false);
    }

    useEffect(() => {
        updateSelections();
    }, [aois])

    useEffect(() => {
        onMount?.({
            setLoading(newSetting: boolean) {
                setListLoading(newSetting);
            },

            renameObject: (type: SummaryType, id: number, newName: string) => {
                let newAois: AOISummary[];
                setListLoading(true);

                // for AREA
                if (type == "area") {
                    setAois((prev) => prev.map((a) => (
                        a.id === id ? ({ ...a, name: newName }) : a
                    )))
                }

                // for SUBAREA
                else if (type == "subarea") {
                    setAois((prev => prev.map((a) => ({
                        ...a,
                        subareas: a.subareas?.map((s) => (
                            s.id === id ? ({ ...s, name: newName }) : s
                        ))
                    }))))
                }

                // for CAMERA
                else if (type == "camera") {
                    setAois((prev) => prev.map((a) => ({
                        ...a,
                        subareas: a.subareas?.map((s) => ({
                            ...s,
                            cameras: s.cameras?.map((c) => (
                                c.id === id ? ({...c, name: newName}) : c
                            ))
                        }))
                    })))
                }
            },
            addCamera: (camera, subareaId) => {
                setSelectedSubarea((prev) => {
                    if (!prev || prev.id !== subareaId) return prev;
                    return {
                        ...prev,
                        cameras: [...(prev.cameras ?? []), camera],
                        camera_count: prev.camera_count + 1,
                    };
                });
                setAois((prev) => prev.map((a) => ({
                    ...a,
                    subareas: a.subareas?.map((s) => s.id !== subareaId ? s : {
                        ...s,
                        cameras: [...(s.cameras ?? []), camera],
                        camera_count: s.camera_count + 1,
                    }),
                })));
            },
            selectCamera: (cameraId) => {
                const numId = Number(cameraId);
                const camera = selectedSubareaRef.current?.cameras?.find((c) => c.id === numId);
                if (!camera) return;
                setSelectedCamera(camera);
                onCameraEnterRef.current?.(camera);
            },

            deleteObject: (type: SummaryType, id: number) => {
                setListLoading(true);
                // trace id path for quick reference
                const pathTrace = getObjectPathTraceFromId(type, id);
                if (!pathTrace) {return} // quickfail
                // for AREA
                if (type == "area") {
                    setAois((prev) => 
                        prev.filter((a) => a.id !== id)
                    )
                    console.log(aois)
                }

                // for SUBAREA
                else if (type == "subarea") {
                    setAois((prev) => prev.map((a) => (
                        a.id == pathTrace.area ? {
                            ...a,
                            subareas: a.subareas?.filter((s) => s.id !== id),
                            subarea_count: a.subarea_count - 1,
                        } : a
                    )))
                }

                // for CAMERA
                else if (type == "camera") {
                    setAois((prev) => prev.map((a) => (
                        a.id == pathTrace.area ? {
                            ...a,
                            subareas: a.subareas.map((s) => (
                                s.id == pathTrace.subarea ? {
                                    ...s,
                                    cameras: s.cameras?.filter((c) => c.id !== id),
                                    camera_count: s.camera_count - 1,
                                } : s
                            ))
                        } : a
                    )))
                    if (selectedCamera.id = id) { handleBack() } // back if currently selected subarea
                }

                updateSelections();
                setListLoading(false);
            },

            createObject: (obj: LocationSummary, parentId?: number) => {
                setListLoading(true);
                // for AREA
                if (isAreaSummary(obj)) {
                    setAois((prev) => [...(prev ?? []), obj])
                }

                // for SUBAREA
                else if (isSubareaSummary(obj)) {
                    const pathTrace = getObjectPathTraceFromId("area", parentId);
                    setAois((prev) => prev.map((a) => (
                        a.id == pathTrace.area ? {
                            ...a,
                            subareas: [...(a.subareas ?? []), obj],
                            subarea_count: a.subarea_count + 1,
                        } : a
                    )))
                }

                // for CAMERA
                else if (isCameraSummary(obj)) {
                    const pathTrace = getObjectPathTraceFromId("subarea", parentId);
                    setAois((prev) => prev.map((a) => (
                        a.id == pathTrace.area ? {
                            ...a,
                            subareas: a.subareas.map((s) => (
                                s.id == pathTrace.subarea ? {
                                    ...s,
                                    cameras: [...(s.cameras ?? []), obj],
                                    camera_count: s.camera_count + 1,
                                } : s
                            )) 
                        } : a
                    )))
                }

                console.log("hi")
                updateSelections();
                setListLoading(false);
            },
        });
    }, [onMount, setAois, selectedAOI, selectedSubarea, selectedCamera, setSelectedAOI, setSelectedSubarea, setSelectedCamera, listLoading, setListLoading]);

    // loads in all data from the api
    useEffect(() => {
        // flip when user cancels loading operation
        let cancelled = false;
        setListLoading(true);
        
        // load all data for all the user's saved locations and cameras
        Promise.all([
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=aoi`).then((r) => r.json()),
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=sub_area`).then((r) => r.json()),
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cameras`).then((r) => r.json())
        ])
            .then(([aoiData, subData, cameraData]) => {
                if (cancelled) return; // quickfail if cancelled

                // sorts subareas by their parent area
                const rawSubs: any[] = Array.isArray(subData?.saved_locations) ? subData.saved_locations : [];
                const subsByParent = rawSubs.reduce<Record<number, any[]>>((acc, s) => {
                    const pid = s.parent_id;
                    if (pid != null) (acc[pid] ??= []).push(s);
                    return acc;
                }, {});

                // sorts cameras by their parent subarea
                const rawCameras: any[] = Array.isArray(cameraData?.cameras) ? cameraData.cameras : [];
                const camerasByParent = rawCameras.reduce<Record<number, any[]>>((acc, s) => {
                    const pid = s.saved_location;
                    if (pid != null) (acc[pid] ??= []).push(s);
                    return acc;
                }, {});

                const rawAois: any[] = Array.isArray(aoiData?.saved_locations) ? aoiData.saved_locations : [];
                const built: AOISummary[] = rawAois.map((a) => {
                    const subs: SubAreaSummary[] = (subsByParent[a.id] ?? []).map((s: any) => {
                        const cameras: CameraSummary[] = (camerasByParent[s.id] ?? []).map((c: any) => (
                            convertObjectToCameraSummary(c)
                        ))
                        return convertObjectToSubareaSummary(s, {
                            cameras: cameras,
                            vehicle_breakdown: (s.vehicle_breakdown ?? {}) as Record<string, number>,
                        })
                    })
                    return convertObjectToAreaSummary(a, {
                        subarea_count: subs.length,
                        camera_count: subs.reduce((n, s) => n + s.camera_count, 0),
                        vehicles: subs.reduce((n, s) => n + s.vehicles, 0),
                        adb: subs.reduce((n, s) => n + s.adb, 0),
                        speeding: subs.reduce((n, s) => n + s.speeding, 0),
                        swerving: subs.reduce((n, s) => n + s.swerving, 0),
                        abrupt_stopping: subs.reduce((n, s) => n + s.abrupt_stopping, 0),
                        vehicle_breakdown: (() => {
                            const merged: Record<string, number> = {};
                            for (const s of subs) {
                                for (const [type, count] of Object.entries(s.vehicle_breakdown)) {
                                    merged[type] = (merged[type] ?? 0) + count;
                                }
                            }
                            return Object.entries(merged).map(([label, value]) => ({
                                label: label.charAt(0).toUpperCase() + label.slice(1),
                                value,
                            }));
                        })(),
                        subareas: subs,
                    })
                })

                setAois(built);
                setSelectedAOI((prev) => {
                    if (!prev) return null;
                    return built.find((a) => a.id === prev.id) ?? prev;
                });
                setSelectedSubarea((prev) => {
                    if (!prev) return null;
                    for (const a of built) {
                        const found = a.subareas?.find((s) => s.id === prev.id);
                        if (found) return found;
                    }
                    return prev;
                });
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setListLoading(false); });

        return () => { cancelled = true; setListLoading(false) };
    }, [refreshTrigger]);

    // triggers when user selects a card, sets the related area/subarea/camera
    const handleSelectCard = ( item: AOISummary | SubAreaSummary | CameraSummary ) => {
        if (isCameraSummary(item)) {
            // for cameras
            onCameraEnter?.(item);
            onFeedTabActive?.(true);
            setSelectedCamera(item);
        } else if (isSubareaSummary(item)) {
            // for subareas
            onSelectSubarea?.(item.id, (item.cameras ?? []).map((c) => c.id));
            setSelectedSubarea(item);
        } else if (isAreaSummary(item)) {
            // for areas
            onAoiEnter?.(item);
            setSelectedAOI(item);
        } else {
            return;
        }

        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }

    // triggers when user presses a back button
    const handleBack = () => {
        if (selectedCamera !== null) {
            onCameraBack?.();
            onFeedTabActive?.(false);
            setSelectedCamera(null);
        } else if (selectedSubarea !== null) {
            onSubareaBack?.();
            setSelectedSubarea(null);
        } else if (selectedAOI !== null) {
            onAoiBack?.();
            setSelectedAOI(null);
        } else {
            return;
        }
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    // handles the sign out process - removes user session data from the browser
    const handleSignOut = () => {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("username");
        router.push("/logIn");
    };

    const handleAddArea = () => {
        onAddArea?.();
    };

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
                { listLoading ? ( <>
                    <div className="loadingContainer">
                        <CircularProgress size={24} sx={{ color: "#1d1f3f"  }} />
                        <span className="placeholderText"> Loading data... </span>
                    </div>
                </> ) : ( <> 

                    {selectedCamera && (
                        <CameraDetailMenu
                            camera={selectedCamera}
                            detailLoading={detailLoading}
                            onBack={handleBack}
                            onRenameCamera={onRenameCamera}
                            onRecalibrateCamera={onRecalibrateCamera}
                            onDeleteCamera={onDeleteCamera}
                            onClickUploadVideo={onCameraUpload}
                            onFeedTabActive={onFeedTabActive}
                            parentName={selectedSubarea.name}
                        />
                    )}
                    
                    { !selectedCamera && selectedSubarea && (
                        <SubareaDetailMenu
                            subarea={selectedSubarea}
                            detailLoading={detailLoading}
                            onBack={handleBack}
                            onRenameSubarea={onRenameSubarea}
                            onDeleteSubarea={onDeleteSubarea}
                            canClickThrough={canClickToCameras}
                            onNavigateCamera={handleSelectCard}
                            onCameraClick={onCameraClick}
                            parentName={selectedAOI.name}
                            onAddCamera={onAddCamera}
                            isAddingCamera={isDrawingCamera}
                        />
                    )}

                    { !selectedCamera && !selectedSubarea && selectedAOI && (
                        // AOI detail – if an AOI is currently selected
                        <AoiDetailMenu
                            aoi={selectedAOI}
                            detailLoading={detailLoading}
                            onBack={handleBack}
                            onAddSubarea={onAddSubarea}
                            isDrawingSubarea={isDrawingSubarea}
                            canClickThrough={canClickToSubareas}
                            onSubareaHover={onSubareaHover}
                            onSubareaClick={onSubareaClick}
                            onRenameArea={onRenameAoi}
                            onDeleteArea={onDeleteAoi}
                            onNavigateSubarea={handleSelectCard}
                        />
                    )}

                    { !selectedCamera && !selectedSubarea && !selectedAOI && (
                        // main menu – list of all AOIs
                        // Panel 1: AOI list
                        <AllAoiMenu
                            aois = {aois}
                            listLoading = {listLoading}
                            isDrawingAOI = {isDrawingAOI}
                            canClickThrough={canClickToAreas}
                            onAoiHover = {onAoiHover}
                            onAoiClick = {onAoiClick}
                            handleAddArea = {handleAddArea} 
                            handleSelectAOI = {handleSelectCard} 
                        />
                    )}
                </> )}

            </Box>
        </Box>
    );
}