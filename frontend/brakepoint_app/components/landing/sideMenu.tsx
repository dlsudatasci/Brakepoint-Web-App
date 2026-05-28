"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Chip, CircularProgress, Divider, IconButton } from "@mui/material";
import { useRouter } from "next/navigation";
import styles from "./menuBar.module.css";
import { authFetch } from "@/lib/authFetch";

// components
import AnalyticsCard, { StackedBar } from "./analyticsCard";
import LocationCard, { type LocationSummary } from "./locationCard";
import ModeSegmentedControl from "@/components/landing/modeToggle";
import LandingSection from "@/components/landing/landingSection"
import Timeline from "@/components/landing/timeline";

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

export type SubAreaType = "road_segment" | "intersection" | "junction";

export type SubAreaSummary = {
    id: number;
    name: string;
    lat: number;
    lng: number;
    camera_count: number;
    subarea_count: number;
    vehicles: number;
    adb: number;
    speeding: number;
    swerving: number;
    abrupt_stopping: number;
    tags: string[];
    vehicle_breakdown: Record<string, number>;
    sub_area_type: SubAreaType | null;
};

export type AOISummary = {
    id: number;
    name: string;
    location?: string;
    subarea_count: number;
    camera_count: number;
    vehicles: number;
    adb: number;
    speeding: number;
    swerving: number;
    abrupt_stopping: number;
    vehicle_breakdown?: { label: string; value: number }[];
    subareas?: SubAreaSummary[];
};

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
    const details: LocationSummary = {
        location_type: "aoi",
        name: aoi.name,
        lat: 0, lng: 0,
        camera_count: aoi.camera_count,
        subarea_count: aoi.subarea_count,
        vehicles: aoi.vehicles,
        adb: aoi.adb,
        speeding: aoi.speeding,
        swerving: aoi.swerving,
        abrupt_stopping: aoi.abrupt_stopping,
        tags: [],
    };

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
    onNavigateSubarea?: (id: number) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {
    const subDetails: LocationSummary = {
        location_type: "subarea",
        name: subarea.name,
        lat: subarea.lat,
        lng: subarea.lng,
        camera_count: subarea.camera_count,
        subarea_count: 0,
        vehicles: subarea.vehicles,
        adb: subarea.adb,
        speeding: subarea.speeding,
        swerving: subarea.swerving,
        abrupt_stopping: subarea.abrupt_stopping,
        tags: subarea.tags,
    };
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
                onClickSideButton={() => onNavigateSubarea?.(subarea.id)}
            />
        </Box>
    )
}






// displays the details for a selected AOI (name, loc, stats, subareas)
function AOIDetail({
    aoi,
    detailLoading,
    onBack,
    onAddSubarea,
    isDrawingSubarea,
    onNavigateSubarea,
    onSubareaHover,
    onSubareaClick,
} : {
    aoi: AOISummary;
    detailLoading?: boolean;
    onBack: () => void;
    onAddSubarea?: (type: SubAreaType) => void;
    isDrawingSubarea?: SubAreaType | false;
    onNavigateSubarea?: (id: number) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {
    const [statsOpen, setStatsOpen] = useState(false);
    const [roadOpen, setRoadOpen] = useState(false);
    const [intersectionOpen, setIntersectionOpen] = useState(false);
    const [junctionOpen, setJunctionOpen] = useState(false);

    const pct = (n: number) =>
        aoi.vehicles > 0 ? `${((n / aoi.vehicles) * 100).toFixed(1)}%` : "0.0%";

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
                            <AnalyticsCard compact headerText="Speeding" icon={<SpeedOutlinedIcon />} variant="text" valueText={`${aoi.speeding} (${pct(aoi.speeding)})`} />
                            <AnalyticsCard compact headerText="Swerving" icon={<SwapCallsIcon />} variant="text" valueText={`${aoi.swerving} (${pct(aoi.swerving)})`} />
                            <AnalyticsCard compact headerText="Abrupt Stop" icon={<PanToolOutlinedIcon />} variant="text" valueText={`${aoi.abrupt_stopping} (${pct(aoi.abrupt_stopping)})`} />
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





export default function SideMenu({ onAddArea, onSelectSubarea, refreshTrigger, isDrawingAOI = false, onAoiHover, onAoiClick, onAoiEnter, onAoiBack, onAddSubarea, isDrawingSubarea = false, onSubareaHover, onSubareaClick, onMount }: SideMenuProps) {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);

    const [aois, setAois] = useState<AOISummary[]>([]);
    const [selectedAOI, setSelectedAOI] = useState<AOISummary | null>(null);
    const selectedAOIRef = useRef<AOISummary | null>(null);
    selectedAOIRef.current = selectedAOI;
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
        let cancelled = false;
        setListLoading(true);

        Promise.all([
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=aoi`).then((r) => r.json()),
            authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/saved-locations/?type=sub_area`).then((r) => r.json()),
        ])
            .then(([aoiData, subData]) => {
                if (cancelled) return;

                const rawSubs: any[] = Array.isArray(subData?.saved_locations) ? subData.saved_locations : [];
                const subsByParent = rawSubs.reduce<Record<number, any[]>>((acc, s) => {
                    const pid = s.parent_id;
                    if (pid != null) (acc[pid] ??= []).push(s);
                    return acc;
                }, {});

                const rawAois: any[] = Array.isArray(aoiData?.saved_locations) ? aoiData.saved_locations : [];
                const built: AOISummary[] = rawAois.map((a) => {
                    const subs: SubAreaSummary[] = (subsByParent[a.id] ?? []).map((s: any) => ({
                        id: s.id,
                        name: s.name,
                        lat: s.lat ?? 0,
                        lng: s.lng ?? 0,
                        camera_count: s.camera_count ?? 0,
                        subarea_count: 0,
                        vehicles: s.vehicles ?? 0,
                        adb: s.occurrences ?? 0,
                        speeding: s.speeding ?? 0,
                        swerving: s.swerving ?? 0,
                        abrupt_stopping: s.abrupt_stopping ?? 0,
                        tags: s.tags ?? [],
                        vehicle_breakdown: (s.vehicle_breakdown ?? {}) as Record<string, number>,
                        sub_area_type: s.sub_area_type as SubAreaType | null,
                    }));

                    return {
                        id: a.id,
                        name: a.name,
                        location: undefined,
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
                    };
                });

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

    const handleSelectAOI = (aoi: AOISummary) => {
        onAoiEnter?.(aoi);
        setSelectedAOI(aoi);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleBack = () => {
        onAoiBack?.();
        setSelectedAOI(null);
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
                {selectedAOI ? (
                    // AOI detail – if an AOI is currently selected
                    <AOIDetail
                        aoi={selectedAOI}
                        detailLoading={detailLoading}
                        onBack={handleBack}
                        onAddSubarea={onAddSubarea}
                        isDrawingSubarea={isDrawingSubarea}
                        onSubareaHover={onSubareaHover}
                        onSubareaClick={onSubareaClick}
                        onNavigateSubarea={(id) => {
                            onSelectSubarea?.(id);
                            router.push(`/configuration?savedLocationId=${id}`);
                        }}
                    />
                ) : (
                    // main menu – list of all AOIs
                    // Panel 1: AOI list

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
                )}
            </Box>
        </Box>
    );
}