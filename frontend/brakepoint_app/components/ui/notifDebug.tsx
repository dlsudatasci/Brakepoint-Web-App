import { useNotifications } from "@/contexts/NotificationContext";
import { Button } from "@mui/material";

export default function NotificationDebugButton() {
  const { addNotification, trackVideoProcessing, showToast } = useNotifications();
  const debugId = 930002

  return (
    <>
      <Button
        variant="contained"
        onClick={() => {
          addNotification("Debug: Success Notification", true, { note: "manual test payload" });
          showToast("Debug toast fired", "info");
        }}
      >
        Fire Success Notification
      </Button>

      <Button
        variant="outlined"
        onClick={() => {
          addNotification("Debug: Failure Notification", false, { error: "simulated failure" });
          showToast("Debug failure toast fired", "error");
        }}
        sx={{ ml: 2 }}
      >
        Fire Failure Notification
      </Button>

      <Button
        variant="text"
        onClick={() => {
          // Use a videoId you know exists in your backend
          trackVideoProcessing("Debug: Processing Notification", debugId);
          showToast("Started debug processing poll", "info");
        }}
        sx={{ ml: 2 }}
      >
        Start Processing Poll (videoId={debugId})
      </Button>
    </>
  );
}