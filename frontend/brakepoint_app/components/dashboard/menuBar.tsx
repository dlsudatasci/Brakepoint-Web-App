"use client";

import { Box, Typography, Button } from "@mui/material";
import { useRouter } from "next/navigation";

import MapIcon from "@mui/icons-material/Map";
import DashboardIcon from "@mui/icons-material/Dashboard";
import EditIcon from "@mui/icons-material/Edit";
import LogoutIcon from "@mui/icons-material/Logout";

import styles from "./menuBar.module.css";

// definition of types for the props for MenuBar
interface MenuBarProps {
  activeView?: "analytics" | "edit";                    // the currently active page to be highlighted
  onViewChange?: (view: "analytics" | "edit") => void;  // triggers when the user clicks on a button
}

export default function MenuBar({ activeView = "analytics", onViewChange }: MenuBarProps) {
  const router = useRouter();

  // handles the sign out process - removes user session data from the browser
  const handleSignOut = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("username");
    router.push("/logIn");
  };

  return (
    <Box className={styles.menuContainer}>
      <Typography variant="h3" className={styles.brakePoint}>BrakePoint</Typography>

      <Box className={styles.buttonContainer}>
        <Button
          className={styles.menuButton}
          startIcon={<DashboardIcon />}
          onClick={() => onViewChange?.("analytics")}
          sx={activeView === "analytics" ? { bgcolor: "rgba(255,255,255,0.1) !important" } : {}}
        >
          Analytics
        </Button>

        <Button className={styles.menuButton} startIcon={<MapIcon />} onClick={() => router.push('/explore')}>
          Explore
        </Button>

        <Button className={styles.menuButton} startIcon={<LogoutIcon />} onClick={handleSignOut}>
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
