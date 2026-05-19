"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Chip, CircularProgress, Divider } from "@mui/material";
import { useRouter } from "next/navigation";

import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import AnalyticsCard, { StackedBar } from "./analyticsCard";
import LocationCard, { type LocationSummary } from "./locationCard";
import styles from "./menuBar.module.css";
import { authFetch } from "@/lib/authFetch";

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
};

// definition of types for the props for MenuBar
interface SideMenuProps {
    onAddArea?: () => void;                              // triggers when the user clicks the "add area" button
    onSelectSubarea?: (subareaId: number) => void;       // triggers when the user selects a subarea
    refreshTrigger?: number;                             // increment to re-fetch the AOI list
    isDrawingAOI?: boolean;                              // true while the user is drawing an AOI on the map
    onAoiHover?: (id: number | null) => void;            // called with AOI id on hover, null on leave
    onAoiClick?: (id: number) => void;                   // called when an AOI card is clicked — opens edit/delete dialog
    onAoiEnter?: (aoi: AOISummary) => void;              // called when the arrow button is clicked — zooms map to AOI
    onAoiBack?: () => void;                              // called when the user navigates back from an AOI detail view
    onAddSubarea?: () => void;                           // called when + in Road Segments is clicked
    isDrawingSubarea?: boolean;                          // true while the user is drawing a road segment polygon
    onSubareaHover?: (id: number | null) => void;        // called with sub-area id on hover, null on leave
    onSubareaClick?: (id: number, name: string) => void;  // called when a road segment card body is clicked — opens edit/delete dialog
    onMount?: (updater: SideMenuUpdater) => void;          // provides direct update fns to avoid full refetch on edit/delete
}

// displays list of AOIs
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
}: {
    aoi: AOISummary;
    detailLoading?: boolean;
    onBack: () => void;
    onAddSubarea?: () => void;
    isDrawingSubarea?: boolean;
    onNavigateSubarea?: (id: number) => void;
    onSubareaHover?: (id: number | null) => void;
    onSubareaClick?: (id: number, name: string) => void;
}) {
    const [statsOpen, setStatsOpen] = useState(true);

    const pct = (n: number) =>
        aoi.vehicles > 0 ? `${((n / aoi.vehicles) * 100).toFixed(1)}%` : "0.0%";

    return (
        <Box sx={{ width: "100%", display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>

            {/* back button */}
            <Button
                onClick={onBack}
                startIcon={<ChevronLeftIcon />}
                sx={{
                    alignSelf: "flex-start",
                    color: "#1d1f3f",
                    fontWeight: 600,
                    fontSize: "0.78rem",
                    padding: "4px 12px",
                    borderRadius: "20px",
                    bgcolor: "#fff",
                    boxShadow: "0 1px 4px #00000018",
                    textTransform: "none",
                    "&:hover": { bgcolor: "#1d1f3f", color: "#fff" },
                }}
            >
                Back to all AOIs
            </Button>

            {/* AOI name + city */}
            <Box>
                <Typography variant="h4" fontWeight={800} sx={{ color: "#1d1f3f", lineHeight: 1.1 }}>
                    {aoi.name}
                </Typography>
                {aoi.location && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                        <LocationOnOutlinedIcon sx={{ fontSize: "0.85rem", color: "#888" }} />
                        <Typography sx={{ fontSize: "0.82rem", color: "#888" }}>{aoi.location}</Typography>
                    </Box>
                )}
            </Box>

            {/* Overview */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#1d1f3f" }}>Overview</Typography>
                {detailLoading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                        <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading breakdown…</Typography>
                    </Box>
                ) : (
                    <AnalyticsCard
                        headerText="Total Vehicle Count"
                        icon={<DirectionsCarIcon />}
                        variant="bar"
                        data={aoi.vehicle_breakdown ?? []}
                        compact
                    />
                )}
            </Box>

            {/* Statistics */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>

                {/* toggle header */}
                <Box
                    onClick={() => setStatsOpen((o) => !o)}
                    sx={{
                        display: "flex", alignItems: "center", gap: 0.5,
                        cursor: "pointer", userSelect: "none",
                        "&:hover .stats-label": { color: "#1d1f3f" },
                    }}
                >
                    <Typography
                        className="stats-label"
                        sx={{ fontSize: "0.9rem", fontWeight: 700, color: "#444", transition: "color 0.15s ease" }}
                    >
                        Statistics
                    </Typography>
                    <ExpandMoreIcon
                        sx={{
                            fontSize: "1.1rem",
                            color: "#888",
                            transition: "transform 0.2s ease",
                            transform: statsOpen ? "rotate(180deg)" : "rotate(0deg)",
                        }}
                    />
                </Box>

                {/* collapsible content */}
                {statsOpen && (
                    detailLoading ? (
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
                    )
                )}
            </Box>

            <Divider sx={{ borderColor: "#aeb2b9" }} />

            {/* Road Segments header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Typography variant="h6" fontWeight={700} sx={{ color: "#1d1f3f" }}>Road Segments</Typography>
                <Chip
                    label={aoi.subarea_count}
                    size="small"
                    variant="outlined"
                    sx={{ color: "#161b4c", borderColor: "#161b4c", borderWidth: "2px", fontWeight: 700, fontSize: "0.75rem", height: 22, minWidth: 28 }}
                />
                <Button
                    onClick={onAddSubarea}
                    sx={{
                        marginLeft: "auto", minWidth: 0, padding: "3px 6px", borderRadius: "8px",
                        color: isDrawingSubarea ? "rgb(236, 237, 245)" : "#1d1f3f",
                        bgcolor: isDrawingSubarea ? "#1d1f3f" : "transparent",
                        "&:hover": { bgcolor: "#1d1f3f", color: "rgb(236, 237, 245)" },
                    }}
                >
                    {isDrawingSubarea ? <CloseIcon /> : <AddIcon />}
                </Button>
            </Box>

            {/* displays the road segment cards */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {detailLoading ? (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 1 }}>
                        <CircularProgress size={14} sx={{ color: "#1d1f3f" }} />
                        <Typography sx={{ fontSize: "0.75rem", color: "#999" }}>Loading road segments…</Typography>
                    </Box>
                ) : aoi.subareas && aoi.subareas.length > 0 ? (
                    aoi.subareas.map((sub) => {
                        const subDetails: LocationSummary = {
                            location_type: "subarea",
                            name: sub.name,
                            lat: sub.lat,
                            lng: sub.lng,
                            camera_count: sub.camera_count,
                            subarea_count: 0,
                            vehicles: sub.vehicles,
                            adb: sub.adb,
                            speeding: sub.speeding,
                            swerving: sub.swerving,
                            abrupt_stopping: sub.abrupt_stopping,
                            tags: sub.tags,
                        };
                        return (
                            <Box
                                key={sub.id}
                                onMouseEnter={() => onSubareaHover?.(sub.id)}
                                onMouseLeave={() => onSubareaHover?.(null)}
                            >
                                <LocationCard
                                    type="subarea"
                                    locationDetails={subDetails}
                                    onClickCard={() => onSubareaClick?.(sub.id, sub.name)}
                                    onClickSideButton={() => onNavigateSubarea?.(sub.id)}
                                />
                            </Box>
                        );
                    })
                ) : (
                    <Typography
                        sx={{
                            fontSize: "0.8rem", color: "#999", padding: "14px",
                            borderRadius: "12px", border: "1.5px dashed rgba(0,0,0,0.15)", lineHeight: 1.6,
                        }}
                    >
                        No road segments yet. Press <strong>+</strong> to add one.
                    </Typography>
                )}
            </Box>
        </Box>
    );
}

export default function SideMenu({ onAddArea, onSelectSubarea, refreshTrigger, isDrawingAOI = false, onAoiHover, onAoiClick, onAoiEnter, onAoiBack, onAddSubarea, isDrawingSubarea = false, onSubareaHover, onSubareaClick, onMount }: SideMenuProps) {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);

    const [aois, setAois] = useState<AOISummary[]>([]);
    const [selectedAOI, setSelectedAOI] = useState<AOISummary | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [listLoading, setListLoading] = useState(true);

    // Register direct-update functions so the parent can optimistically update
    // the sub-area list without triggering a full API refetch.
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
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
                        vehicle_breakdown: [],
                        subareas: subs,
                    };
                });

                setAois(built);
                // Keep selectedAOI in sync with fresh data (e.g. new sub-areas)
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

            <Box
                ref={scrollRef}
                sx={{
                    width: "100%", mt: "1em", flex: 1, overflowY: "auto", paddingBottom: "2em",
                    "&::-webkit-scrollbar": { width: 4 },
                    "&::-webkit-scrollbar-thumb": { bgcolor: "#c5c7d8", borderRadius: 4 },
                }}
            >
                {selectedAOI ? (

                    // ── Panel 2: AOI detail ──
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

                    // ── Panel 1: AOI list ──
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                            <Typography variant="h5" fontWeight="bold">Areas</Typography>
                            <Chip
                                label={aois.length}
                                size="small"
                                variant="outlined"
                                sx={{ color: "#161b4c", borderColor: "#161b4c", borderWidth: "2px", fontWeight: 700, fontSize: "0.75rem", height: 22, minWidth: 28 }}
                            />
                            <Button
                                onClick={handleAddArea}
                                sx={{
                                    marginLeft: "auto", minWidth: 0, padding: "2px 6px", borderRadius: "8px",
                                    color: isDrawingAOI ? "rgb(236, 237, 245)" : "#161b4c",
                                    bgcolor: isDrawingAOI ? "#161b4c" : "transparent",
                                    "&:hover": { bgcolor: "#161b4c", color: "rgb(236, 237, 245)" },
                                }}
                            >
                                {isDrawingAOI ? <CloseIcon /> : <AddIcon />}
                            </Button>
                        </Box>

                        {listLoading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                                <CircularProgress size={24} sx={{ color: "#1d1f3f" }} />
                            </Box>
                        ) : aois.length === 0 ? (
                            <Typography
                                sx={{
                                    fontSize: "0.8rem", color: "#999", padding: "14px",
                                    borderRadius: "12px", border: "1.5px dashed rgba(0,0,0,0.15)", lineHeight: 1.6,
                                }}
                            >
                                No areas yet. Press <strong>+</strong> to add one.
                            </Typography>
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
                    </Box>
                )}
            </Box>
        </Box>
    );
}