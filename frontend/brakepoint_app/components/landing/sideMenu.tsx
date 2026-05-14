"use client";

import { Box, Typography, Button, Chip } from "@mui/material";
import { useRouter } from "next/navigation";

import LogoutIcon from "@mui/icons-material/Logout";
import AddIcon from '@mui/icons-material/Add';

import styles from "./menuBar.module.css";

// definition of types for the props for MenuBar
interface SideMenuProps {
    activeView?: "analytics" | "edit";                    // the currently active page to be highlighted
    onViewChange?: (view: "analytics" | "edit") => void;  // triggers when the user clicks on a button
    areaCount?: number;                                  // the number of AOIs the user has created, to be displayed in the menu
    onAddArea?: () => void;                                // triggers when the user clicks the "add area" button
}

export default function SideMenu({ activeView = "analytics", onViewChange, areaCount = 0 , onAddArea }: SideMenuProps) {
    const router = useRouter();

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
            router.push("/explore"); // fallback: go to explore to draw a new AOI
        }
    };

    return (
        <>
            <Box className={styles.menuContainer}>
                <Box className={styles.menuHeader}>
                    <Typography variant="h3" className={styles.brakePoint}>BrakePoint</Typography>
                    <Button
                        onClick={handleSignOut}
                        sx={{
                            marginLeft: '9em',
                            minWidth:0,
                            padding: '5px 20px 5px 20px',
                            color: 'rgb(236, 237, 245)',
                            cursor: 'pointer',
                            "&:hover": { bgcolor: "rgb(236, 237, 245)", color: "#161b4c" },
                        }}
                    >
                        <LogoutIcon sx={{fontSize: '1.8rem'}}/>
                    </Button>

                </Box>

                {/* Areas Header */}
                <Box className={styles.areasHeader}>
                    <Typography variant="h5" fontWeight="bold">Areas</Typography>

                    {/* counter badge */}
                    <Chip
                        label={areaCount}
                        size="small"
                        variant="outlined"
                        sx={{
                            color: "#161b4c",
                            borderColor: "#161b4c",
                            borderWidth: '2px',
                            fontWeight: 700,
                            fontSize: "0.75rem",
                            height: 22,
                            minWidth: 28,
                        }}
                    />

                    {/* add a new main AOI */}
                    <Button
                        onClick={handleAddArea}
                        sx={{
                            fontSize: "0.75rem",
                            minWidth: 0,
                            padding: "2px 6px",
                            alignSelf: "right",
                            marginLeft: "auto",
                            color: "#161b4c",
                            "&:hover": { bgcolor: "#161b4c", color: "rgb(236, 237, 245)" },
                        }}
                    >
                        <AddIcon />
                    </Button>
                </Box>

                {/* AOI cards */ }
                <Box sx={{ marginTop: '4.5em', width: "100%" }}>
                    {areaCount === 0 ? (
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
                        // your AOI cards will go here
                        null
                    )}
                </Box>
            </Box>

        </>
    );
}