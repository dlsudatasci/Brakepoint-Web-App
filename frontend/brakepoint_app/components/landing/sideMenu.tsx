"use client";

import { useState, useEffect, useRef } from "react";
import { Box, Typography, Button, Chip, CircularProgress, Divider } from "@mui/material";
import { useRouter } from "next/navigation";

import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from '@mui/icons-material/Add';
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

// definition of types for the props for MenuBar
interface SideMenuProps {
    onAddArea?: () => void;                                // triggers when the user clicks the "add area" button
    onSelectSubarea?: (subareaId: number) => void;   // triggers when the user selects a subarea
}

// mock data for main AOI
const MOCK_AOI: AOISummary = {
    id: 1,
    name: "Manila",
    location: "Manila",
    subarea_count: 0,
    camera_count: 0,
    vehicles: 0,
    adb: 0,
    speeding: 0,
    swerving: 0,
    abrupt_stopping: 0,
};


// displays list of AOIs
function AOIListItem({ aoi, onClick }: { aoi: AOISummary; onClick: () => void }) {
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
                onClickCard={() => { }}
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
    onNavigateSubarea,
}: {
    aoi: AOISummary;
    detailLoading?: boolean;
    onBack: () => void;
    onAddSubarea?: () => void;
    onNavigateSubarea?: (id: number) => void;
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
                    sx={{ marginLeft: "auto", minWidth: 0, padding: "3px 6px", color: "#1d1f3f", borderRadius: "8px", "&:hover": { bgcolor: "#1d1f3f", color: "#fff" } }}
                >
                    <AddIcon />
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
                            <LocationCard
                                key={sub.id}
                                type="subarea"
                                locationDetails={subDetails}
                                onClickSideButton={() => onNavigateSubarea?.(sub.id)}
                            />
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

export default function SideMenu({ onAddArea, onSelectSubarea }: SideMenuProps) {
    const router = useRouter();
    const scrollRef = useRef<HTMLDivElement>(null);

    // list of main AOIs
    const [aois] = useState<AOISummary[]>([MOCK_AOI]);

    const [selectedAOI, setSelectedAOI] = useState<AOISummary | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [listLoading, setListLoading] = useState(true);
    const [hydratedAOI, setHydratedAOI] = useState<AOISummary>(MOCK_AOI);

    useEffect(() => {
        let cancelled = false;
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard-summary/`)
            .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
            .then((json) => {
                if (cancelled || !json.success) return;

                const subareas: SubAreaSummary[] = (json.sub_areas ?? []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    lat: s.lat,
                    lng: s.lng,
                    camera_count: s.camera_count,
                    subarea_count: 0,
                    vehicles: s.vehicles,
                    adb: s.adb,
                    speeding: s.speeding,
                    swerving: s.swerving,
                    abrupt_stopping: s.abrupt_stopping,
                    tags: s.tags ?? [],
                }));

                const vehicle_breakdown = Object.entries(json.vehicle_breakdown ?? {}).map(
                    ([label, value]) => ({ label, value: value as number })
                );

                const merged: AOISummary = {
                    ...MOCK_AOI,
                    vehicles: json.totals?.vehicles ?? 0,
                    adb: json.totals?.adb ?? 0,
                    speeding: json.totals?.speeding ?? 0,
                    swerving: json.totals?.swerving ?? 0,
                    abrupt_stopping: json.totals?.abrupt_stopping ?? 0,
                    subarea_count: subareas.length,
                    camera_count: subareas.reduce((n, s) => n + s.camera_count, 0),
                    vehicle_breakdown,
                    subareas,
                };

                setHydratedAOI(merged);
                setSelectedAOI((prev) => prev ? merged : null);
            })
            .catch(() => { /* keep mock values on error */ })
            .finally(() => { if (!cancelled) setListLoading(false); });
        return () => { cancelled = true; };
    }, []);

    const handleSelectAOI = (aoi: AOISummary) => {
        setSelectedAOI(aoi);
        scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    const handleBack = () => {
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
        if (onAddArea) {
            onAddArea();
        } else {
            router.push("/explore");
        }
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
                        onAddSubarea={() => { if (onAddArea) onAddArea(); else router.push("/explore"); }}
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
                                onClick={() => { if (onAddArea) onAddArea(); else router.push("/explore"); }}
                                sx={{ marginLeft: "auto", minWidth: 0, padding: "2px 6px", color: "#161b4c", borderRadius: "8px", "&:hover": { bgcolor: "#161b4c", color: "rgb(236, 237, 245)" } }}
                            >
                                <AddIcon />
                            </Button>
                        </Box>

                        {listLoading ? (
                            <Box sx={{ display: "flex", justifyContent: "center", pt: 4 }}>
                                <CircularProgress size={24} sx={{ color: "#1d1f3f" }} />
                            </Box>
                        ) : aois.length === 0 ? (
                            <Typography
                                variant="body2"
                                sx={{
                                    color: "text.secondary",
                                    fontSize: "0.8rem",
                                    lineHeight: 1.6,
                                    padding: "12px",
                                    borderRadius: "12px",
                                    border: "1.5px dashed rgba(0,0,0,0.15)",
                                }}
                            >
                                You are not monitoring any areas yet. Press the <strong>+</strong> icon to get started.
                            </Typography>
                        ) : (
                            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>
                                <AOIListItem aoi={hydratedAOI} onClick={() => handleSelectAOI(hydratedAOI)} />
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
}