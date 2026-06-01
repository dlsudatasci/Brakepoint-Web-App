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
    SubAreaType, 
    LocationSummary, AOISummary, SubAreaSummary, CameraSummary,
    isAreaSummary, isSubareaSummary, isCameraSummary,
    convertObjectToAreaSummary, convertObjectToSubareaSummary, convertObjectToCameraSummary
} from "@/components/landing/summaryTypes"

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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

// css
import "./sideMenu.css";


export type SideMenuUpdater = {
    renameSubarea: (id: number, name: string) => void;
    deleteSubarea: (id: number) => void;
    addSubarea: (sub: SubAreaSummary) => void;
};

// definition of types for the props for MenuBar
interface SideMenuProps {
    onAddArea?: () => void;                                // triggers when the user clicks the "add area" button
    onSelectSubarea?: (subareaId: number) => void;         // triggers when the user selects a subarea
    refreshTrigger?: number;                               // increment to re-fetch the AOI list
    isDrawingAOI?: boolean;                                // true while the user is drawing an AOI on the map
    onAoiHover?: (id: number | null) => void;              // called with AOI id on hover, null on leave
    onAoiClick?: (id: number) => void;                     // called when an AOI card is clicked — opens edit/delete dialog
    onAoiEnter?: (aoi: AOISummary) => void;                // called when the arrow button is clicked — zooms map to AOI
    onAoiBack?: () => void;                                // called when the user navigates back from an AOI detail view
    onAddSubarea?: (type: SubAreaType) => void;            // called when + in any segment section is clicked
    isDrawingSubarea?: SubAreaType | false;                // which sub-area type is currently being drawn
    onSubareaHover?: (id: number | null) => void;          // called with sub-area id on hover, null on leave
    onSubareaClick?: (id: number, name: string) => void;   // called when a road segment card body is clicked — opens edit/delete dialog
    onMount?: (updater: SideMenuUpdater) => void;          // provides direct update fns to avoid full refetch on edit/delete
}

// displays a single AOI card
function AOIListItem({ aoi, onClick, onEditClick }: { aoi: AOISummary; onClick: () => void; onEditClick?: () => void }) {
   const details = convertObjectToAreaSummary(aoi);

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            <LocationCard
                type="area"
                locationDetails={details}
                onClickCard={onEditClick ?? (() => {})}
                onClickSideButton={onClick}
            />
        </Box>
    );
}

// displays a single subarea card
function subareaListItem({ subarea, onNavigateSubarea, onSubareaHover, onSubareaClick } : {
    subarea : SubAreaSummary
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
            />
        </Box>
    )
}

// displays a single camera card
function cameraListItem({ camera, onNavigateCamera, onCameraHover, onCameraClick } : {
    camera: CameraSummary
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
                onClickCard={() => onCameraClick?.(camera.id, camera.name)}
                onClickSideButton={() => onNavigateCamera?.(camera)}
            />
        </Box>
    )
}



// displays the sidebar for all AOIs
function AllAoiMenu({ aois, listLoading, isDrawingAOI, onAoiHover, onAoiClick, handleAddArea, handleSelectAOI } : {
    aois: AOISummary[];
    listLoading: boolean;
    isDrawingAOI?: boolean;
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
                                <AOIListItem aoi={aoi} onClick={() => handleSelectAOI(aoi)} onEditClick={() => onAoiClick?.(aoi.id)} />
                            </Box>
                        ))}
                    </Box>
                )}

            </LandingSection>
        </Box>
    )
}

// puts out a percentage as a string value
const pct = (tot: number, n: number) => tot > 0 ? `${((n / tot) * 100).toFixed(1)}%` : "0.0%";



// displays the sidebar for a selected AOI (name, loc, stats, subareas)
function AoiDetailMenu({ aoi, detailLoading, onBack, onAddSubarea, isDrawingSubarea, onNavigateSubarea, onSubareaHover, onSubareaClick, } : {
    aoi: AOISummary;
    detailLoading?: boolean;
    onBack: () => void;
    onAddSubarea?: (type: SubAreaType) => void;
    isDrawingSubarea?: SubAreaType | false;
    onNavigateSubarea?: (sub: SubAreaSummary) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {

    const roadSegments = aoi.subareas?.filter((s) => s.sub_area_type === "road_segment") ?? [];
    const intersections = aoi.subareas?.filter((s) => s.sub_area_type === "intersection") ?? [];
    const junctions = aoi.subareas?.filter((s) => s.sub_area_type === "junction") ?? [];

    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>

            {/* back button */}
            <div className="backButtonContainer">
                <IconButton onClick={onBack}> <ChevronLeftIcon /> </IconButton>
                Back to all AOIs
            </div>

            { /* title, with edit name functions */ }
            <LandingSection type="title" labelHeader={ aoi.name } labelSubheader={ aoi.location } icon={ <EditIcon /> } onClickIcon={ () => { alert("[TODO: Edit this section]") } } />

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
                    intersections.map((sub) => { return subareaListItem({ subarea: sub, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
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
                    junctions.map((sub) => { return subareaListItem({ subarea: sub, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
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
                    roadSegments.map((sub) => { return subareaListItem({ subarea: sub, onNavigateSubarea, onSubareaClick, onSubareaHover }) })
                ) : (
                    <span className="placeholderText">You are not monitoring any road segments yet. Press the + icon to get started.</span>
                )}
            </LandingSection>

        </Box>
    );
}

// displays the sidebar for a certain subarea
function SubareaDetailMenu({ subarea, detailLoading, onBack, onNavigateCamera, onCameraHover, onCameraClick } : {
    subarea: SubAreaSummary,
    detailLoading?: boolean,
    onBack: () => void;

    onNavigateCamera?: (camera: CameraSummary) => void;
    onCameraHover?: (id: number | null) => void;
    onCameraClick?: (id: number, name: string) => void;
}) {
    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            {/* back button */}
            <div className="backButtonContainer">
                <IconButton onClick={onBack}> <ChevronLeftIcon /> </IconButton>
                Back to all AOIs
            </div>
            
            { /* title, with edit name functions */ }
            <LandingSection
                type="title"
                labelHeader={ subarea.name }
                icon={ <EditIcon /> }
                onClickIcon={ () => { alert("[TODO: Edit this section]") } }
            />

            { /* overview – basic statistics */ }
            <LandingSection type="header" labelHeader="Overview" canHide startHidden>
                {/*
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
                */}


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
                canHide

                canAdd
                isAddButtonActive={ false }
                onActivateAdd={ () => {} }
                onDeactivateAdd={ () => {} }
            >
                {subarea.cameras.length > 0 ? (
                    subarea.cameras.map((c) => { return cameraListItem({ camera: c, onNavigateCamera, onCameraClick, onCameraHover }) })
                ) : (
                    <span className="placeholderText">You do not have any cameras yet for this {subarea.sub_area_type}. Press the + icon to get started.</span>
                )}
            </LandingSection>
        </Box>
    )
}






// handles a general function for the side menu
export default function SideMenu({ onAddArea, onSelectSubarea, refreshTrigger, isDrawingAOI = false, onAoiHover, onAoiClick, onAoiEnter, onAoiBack, onAddSubarea, isDrawingSubarea = false, onSubareaHover, onSubareaClick, onMount }: SideMenuProps) {
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

    // whether the page is loading
    const [detailLoading, setDetailLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);

    useEffect(() => {
        onMount?.({
            renameSubarea: (id, name) => {
                setAois((prev) => prev.map((a) => ({
                    ...a,
                    subareas: a.subareas?.map((s) => (s.id === id ? { ...s, name } : s)),
                })));
                setSelectedAOI((prev) => prev ? ({
                    ...prev,
                    subareas: prev.subareas?.map((s) => (s.id === id ? { ...s, name } : s)),
                }) : null);
            },
            deleteSubarea: (id) => {
                setAois((prev) => prev.map((a) => {
                    const had = a.subareas?.some((s) => s.id === id) ?? false;
                    return {
                        ...a,
                        subareas: a.subareas?.filter((s) => s.id !== id),
                        subarea_count: had ? Math.max(0, a.subarea_count - 1) : a.subarea_count,
                    };
                }));
                setSelectedAOI((prev) => {
                    if (!prev) return null;
                    const had = prev.subareas?.some((s) => s.id === id) ?? false;
                    return {
                        ...prev,
                        subareas: prev.subareas?.filter((s) => s.id !== id),
                        subarea_count: had ? Math.max(0, prev.subarea_count - 1) : prev.subarea_count,
                    };
                });
            },
            addSubarea: (sub) => {
                const parentId = selectedAOIRef.current?.id ?? null;
                setSelectedAOI((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        subareas: [...(prev.subareas ?? []), sub],
                        subarea_count: prev.subarea_count + 1,
                    };
                });
                if (parentId != null) {
                    setAois((prev) => prev.map((a) => a.id !== parentId ? a : {
                        ...a,
                        subareas: [...(a.subareas ?? []), sub],
                        subarea_count: a.subarea_count + 1,
                    }));
                }
            },
        });
    }, []);

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
            })
            .catch(() => {})
            .finally(() => { if (!cancelled) setListLoading(false); });

        return () => { cancelled = true; };
    }, [refreshTrigger]);

    // triggers when user selects a card, sets the related area/subarea/camera
    const handleSelectCard = ( item: AOISummary | SubAreaSummary | CameraSummary ) => {
        if (isCameraSummary(item)) {
            // for cameras
        } else if (isSubareaSummary(item)) {
            // for subareas
            onSelectSubarea?.(item.id);
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
        if (selectedSubarea !== null) {
            onAoiBack?.();
            setSelectedSubarea(null)
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
                
                { selectedSubarea && (
                    <SubareaDetailMenu
                        subarea={selectedSubarea}
                        detailLoading={detailLoading}
                        onBack={handleBack}
                    />
                )}

                { !selectedSubarea && selectedAOI && (
                    // AOI detail – if an AOI is currently selected
                    <AoiDetailMenu
                        aoi={selectedAOI}
                        detailLoading={detailLoading}
                        onBack={handleBack}
                        onAddSubarea={onAddSubarea}
                        isDrawingSubarea={isDrawingSubarea}
                        onSubareaHover={onSubareaHover}
                        onSubareaClick={onSubareaClick}
                        onNavigateSubarea={handleSelectCard}
                    />
                )}

                { !selectedSubarea && !selectedAOI && (
                    // main menu – list of all AOIs
                    // Panel 1: AOI list
                    <AllAoiMenu
                        aois = {aois}
                        listLoading = {listLoading}
                        isDrawingAOI = {isDrawingAOI}
                        onAoiHover = {onAoiHover}
                        onAoiClick = {onAoiClick}
                        handleAddArea = {handleAddArea} 
                        handleSelectAOI = {handleSelectCard} 
                    />
                )}

            </Box>
        </Box>
    );
}