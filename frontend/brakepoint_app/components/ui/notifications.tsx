// notifications.tsx
"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { IconButton, Box, Badge, Menu, MenuItem, Snackbar, Alert, Typography, LinearProgress } from "@mui/material";

import NotificationsIcon from "@mui/icons-material/Notifications";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import { useNotifications } from "@/contexts/NotificationContext";

export default function Notification() {
  const pathname = usePathname();
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const { notifications, markAsRead, clearAll, unreadCount, toast, hideToast } = useNotifications();

  const hiddenRoutes = ["/home", "/logIn", "/signUp"];
  
  if (hiddenRoutes.includes(pathname)) {
    return null;
  }

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
  };

  const handleNotificationRead = (id: string) => {
    markAsRead(id);
  };

  const handleClearAll = () => {
    clearAll();
    setNotificationAnchor(null);
  };

  return (
    <Box>
      <IconButton
        onClick={handleNotificationClick}
        sx={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          backgroundColor: "white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          "&:hover": { backgroundColor: "#f5f5f5" },
        }}
      >
        <Badge badgeContent={unreadCount} color="error">
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={notificationAnchor}
        open={Boolean(notificationAnchor)}
        onClose={handleNotificationClose}
        PaperProps={{
          sx: { maxHeight: 400, width: 350, mt: 1 },
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid #e0e0e0",
          }}
        >
          <Typography variant="h6">Notifications</Typography>
          {notifications.length > 0 && (
            <Typography variant="caption" sx={{ color: "primary.main", cursor: "pointer" }} onClick={handleClearAll}>
              Clear All
            </Typography>
          )}
        </Box>

        {notifications.length === 0 ? (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              No notifications
            </Typography>
          </MenuItem>
        ) : (
          notifications.map((notification) => (
            <MenuItem
              key={notification.id}
              onClick={() => !notification.processing && handleNotificationRead(notification.id)}
              sx={{
                backgroundColor: notification.read ? "transparent" : "#f5f5f5",
                borderLeft: notification.read ? "none" : "4px solid #161b4cff",
                "&:hover": { backgroundColor: notification.read ? "#fafafa" : "#e8e8e8" },
                cursor: notification.processing ? "default" : "pointer",
              }}
            >
              <Box sx={{ width: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                  {notification.processing ? (
                    <HourglassEmptyIcon
                      sx={{
                        width: 20,
                        height: 20,
                        color: "#FF9800",
                        animation: "spin 2s linear infinite",
                        "@keyframes spin": {
                          "0%": { transform: "rotate(0deg)" },
                          "100%": { transform: "rotate(360deg)" },
                        },
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: notification.success ? "#4CAF50" : "#f44336",
                      }}
                    />
                  )}
                  <Typography variant="subtitle2" sx={{ fontWeight: notification.read ? 400 : 600 }}>
                    {notification.videoName}
                  </Typography>
                </Box>

                {notification.processing ? (
                  <Box sx={{ width: "100%", mt: 0.5 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        {notification.processingStage === "yolo"
                          ? "Detecting vehicles…"
                          : notification.processingStage === "complete"
                            ? "Complete"
                            : "Starting…"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        {notification.progress ?? 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={notification.progress ?? 0}
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        bgcolor: "#e0e0e0",
                        "& .MuiLinearProgress-bar": { borderRadius: 3, bgcolor: "#1d1f3f" },
                      }}
                    />
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    {notification.success ? (
                      <>
                        ✓ Processing completed successfully
                        {notification.data?.yolo_results && <> - {notification.data.yolo_results.total_unique || 0} vehicles</>}
                        {notification.data?.sign_results && <>, {notification.data.sign_results.unique_signs || 0} signs</>}
                      </>
                    ) : (
                      <>✗ Processing failed</>
                    )}
                  </Typography>
                )}
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      <Snackbar open={toast.open} autoHideDuration={5000} onClose={hideToast} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert onClose={hideToast} severity={toast.severity} variant="filled" sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
