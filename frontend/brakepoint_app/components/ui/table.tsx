'use client';

import React, { useState, useEffect } from 'react';
import { Button, TextField, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Box, Typography, Snackbar, Alert } from '@mui/material';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import TuneIcon from '@mui/icons-material/Tune';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import SpeedOutlinedIcon from '@mui/icons-material/SpeedOutlined';
import SwapCallsIcon from '@mui/icons-material/SwapCalls';
import PanToolOutlinedIcon from '@mui/icons-material/PanToolOutlined';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs, { Dayjs } from 'dayjs';

import {
  CameraSummary, VideoSummary, formatDurationLabel
} from '@/components/landing/summaryTypes'
import { CameraAddModal, CameraEditModal } from '@/components/landing/cameraModals'
import { useNotifications } from "@/contexts/NotificationContext";

import './table.css';
import { authFetch } from '@/lib/authFetch';


// ------ Calendar Helpers -------

const HOUR_START = 1;
const HOUR_END = 24;
const HOUR_HEIGHT = 56; // px per hour

type PositionedBlock = {
  row: any;
  startHour: number;
  endHour: number;
  col: number;
  colCount: number;
};

// returns the date under the format of YYYY-MM-DD
function toDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// adds a number of days to the given Date object
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

// formats hour labels for the row
function formatHourLabel(hour: number): string {
  if (hour === 12) return '12:00n';
  const suffix = hour < 12 ? 'a' : 'p';
  const h = hour > 12 ? hour - 12 : hour;
  return `${h}:00${suffix}`;
}

// Parse video row's uploaded_time into { dateKey, startHour }
// uploaded_time is stored as new Date(video.uploaded_at).toLocaleString()
// We re-parse via new Date() which handles locale strings reliably in the same browser
function parseVideoTime(row: any): { dateKey: string; startHour: number } | null {
  try {
    const d = new Date(row.recorded_at);
    if (isNaN(d.getTime())) return null;
    return {
      dateKey: toDateKey(d),
      startHour: d.getHours() + d.getMinutes() / 60,
    };
  } catch(e) {
    console.error(e)
    return null;
  }
}

// Assigns non-overlapping columns to blocks that share overlapping time ranges
function layoutDayBlocks(
  blocks: { row: any; dateKey: string; startHour: number }[]
): PositionedBlock[] {
  const withEnd = blocks
    .map(b => ({
      row: b.row,
      startHour: b.startHour,
      endHour: b.startHour + Math.max((b.row.duration_seconds || 0) / 3600, 0.75),
    }))
    .sort((a, b) => a.startHour - b.startHour);

  const positioned: PositionedBlock[] = [];
  let cluster: typeof withEnd = [];
  let clusterEnd = -Infinity;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columns: number[] = []; // each entry = that column's current endHour
    const clusterPositioned: PositionedBlock[] = [];

    for (const b of cluster) {
      let placedCol = -1;
      for (let i = 0; i < columns.length; i++) {
        if (columns[i] <= b.startHour) {
          columns[i] = b.endHour;
          placedCol = i;
          break;
        }
      }
      if (placedCol === -1) {
        columns.push(b.endHour);
        placedCol = columns.length - 1;
      }
      clusterPositioned.push({ ...b, col: placedCol, colCount: 0 });
    }

    const colCount = columns.length;
    clusterPositioned.forEach(b => { b.colCount = colCount; });
    positioned.push(...clusterPositioned);

    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const b of withEnd) {
    if (cluster.length === 0 || b.startHour < clusterEnd) {
      cluster.push(b);
      clusterEnd = Math.max(clusterEnd, b.endHour);
    } else {
      flushCluster();
      cluster.push(b);
      clusterEnd = b.endHour;
    }
  }
  flushCluster();

  return positioned;
}

// parses a duration formatted as a string to a number
function parseDurationSeconds(duration: string): number {
  if (!duration || duration === 'N/A') return 0;
  return parseInt(duration.replace(/[^0-9]/g, ''), 10) || 0;
}


function formatMetadataSource(source?: string | null): string {
  switch (source) {
    case 'metadata':
      return 'Container metadata';
    case 'filename':
      return 'Filename pattern';
    default:
      return 'Unavailable';
  }
}

function buildVideoRow(video: any) {
  const uploadedAt = video.uploaded_at ? new Date(video.uploaded_at) : null;
  const recordedAt = video.start_time ? new Date(video.start_time) : null;
  const validRecordedAt = recordedAt && !isNaN(recordedAt.getTime()) ? recordedAt : null;
  const validUploadedAt = uploadedAt && !isNaN(uploadedAt.getTime()) ? uploadedAt : null;

  return {
    id: video.id,
    camera_id: video.camera,
    video_name: video.filename,
    uploaded_time: validUploadedAt ? validUploadedAt.toLocaleString() : 'N/A',
    uploaded_time_iso: validUploadedAt ? validUploadedAt.toISOString() : null,
    recorded_time: validRecordedAt ? validRecordedAt.toLocaleString() : (validUploadedAt ? validUploadedAt.toLocaleString() : 'N/A'),
    recorded_time_iso: validRecordedAt ? validRecordedAt.toISOString() : (validUploadedAt ? validUploadedAt.toISOString() : null),
    metadata_source: video.start_time_source || 'failed',
    vehicles: video.vehicles || 0,
    signs: video.signs || 0,
    speeding: video.speeding_count || 0,
    swerving: video.swerving_count || 0,
    abrupt_stop: video.abrupt_stopping_count || 0,
    jeepney_hotspot: video.jeepney_hotspot || false,
    duration_seconds: typeof video.duration_seconds === 'number' ? video.duration_seconds : null,
    duration: formatDurationLabel(video.duration_seconds),
    status: video.processing_status || 'pending',
    sign_classes: video.sign_classes || [],
    thumbnail: video.thumbnail || null,
    calibration_points: video.calibration_points || [],
    reference_points: video.reference_points || [],
    reference_distance_meters: video.reference_distance_meters,
  };
}

function formatBlockTimeRange(startHour: number, durationSeconds: number): string {
  const fmt = (h: number) => {
    const totalMinutes = Math.round(h * 60);
    const hrs = Math.floor(totalMinutes / 60) % 24;
    const mins = totalMinutes % 60;
    const suffix = hrs < 12 ? 'am' : 'pm';
    const displayH = hrs === 0 ? 12 : hrs > 12 ? hrs - 12 : hrs;
    return `${String(displayH).padStart(2, '0')}:${String(mins).padStart(2, '0')}${suffix}`;
  };
  const endHour = startHour + durationSeconds / 3600;
  return `${fmt(startHour)} – ${fmt(endHour)}`;
}



// --------- Calendar Card --------------

// creates a single block for the calendar to represent a video
function SessionBlock({
  row, startHour, col, colCount, selected, onClick, onPlay,
}: {
  row: VideoSummary;
  startHour: number;
  col: number;
  colCount: number;
  selected: boolean;
  onClick: () => void;
  onPlay: (e: React.MouseEvent) => void;
}) {
  const durationSecs = row.duration_seconds;
  // minimum 45-min visual height so tiny clips are still readable
  const durationHours = Math.max(durationSecs / 3600, 0.75);
  const top = (startHour - HOUR_START) * HOUR_HEIGHT;
  const height = durationHours * HOUR_HEIGHT;
  const timeLabel = formatBlockTimeRange(startHour, durationSecs);

  const statusColor =
    row.processing_status === 'completed'  ? '#4CAF50' :
    row.processing_status === 'failed'     ? '#f44336' :
    row.processing_status === 'processing' ? '#ff9800' : '#888';

   const EDGE = 5;   
   const GAP = 0;    

  const widthPercent = 100 / colCount;
  const leftPercent = col * widthPercent;

  const leftStyle = colCount === 1
    ? `${EDGE}px`
    : `calc(${leftPercent}% + ${EDGE / colCount + (col > 0 ? GAP / 2 : 0)}px)`;

  const widthStyle = colCount === 1
    ? `calc(100% - ${EDGE * 2}px)`
    : `calc(${widthPercent}% - ${(EDGE * 2) / colCount + GAP}px)`;

  return (
    <div
      className={`cal-block${selected ? ' cal-block--selected' : ''}`}
      style={{
        top: `${top}px`,
        height: `${height}px`,
        left: leftStyle,
        width: widthStyle,
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClick(); }}
    >
      <div className="cal-block__header">
        <span className="cal-block__time">{timeLabel}</span>
        <button className="cal-block__play" aria-label="Play video" onClick={onPlay}>
          <PlayArrowIcon sx={{ fontSize: 13 }} />
        </button>
      </div>

      
      {/* only display if this block contains enough room to store this variable */}
      { height >= 98 && (
        <div className="cal-block__stats">
          <div className="cal-block__col">
            <span className="cal-stat">
              <DirectionsCarIcon sx={{ fontSize: 12 }} />
              <b>{row.vehicles}</b>&nbsp;vehicles
            </span>
            <span className="cal-stat cal-stat--adb">
              <ReportProblemOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.swerving_count}</b>&nbsp;ADB
            </span>
          </div>
          <div className="cal-block__col">
            <span className="cal-stat cal-stat--adb">
              <SpeedOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.speeding_count}</b>&nbsp;speeding
            </span>
            <span className="cal-stat cal-stat--adb">
              <SwapCallsIcon sx={{ fontSize: 12 }} />
              <b>{row.swerving_count}</b>&nbsp;swerving
            </span>
            <span className="cal-stat cal-stat--adb">
              <PanToolOutlinedIcon sx={{ fontSize: 12 }} />
              <b>{row.abrupt_stopping_count}</b>&nbsp;abrupt stopping
            </span>
          </div>
        </div>
      )}

      {/* 
      // removed temp — can we find a better spot for this?
      <span className="cal-block__status" style={{ color: statusColor }}>
        ● {row.status}
      </span>
      */}
    </div>
  );
}

// ------- Main Table -------- 

interface TableProps {
  cameraId?: number | null;                                                                 // id of the current camera
  camera?: CameraSummary | null;                                                            // Summary object of the current camera
  loadedVideos?: VideoSummary[] | null;                                                     // all the videos available to this camera as a VideoSummary object

  onVideoFileSelect: (url: string, thumbnail?: string) => void;                             // runs when the user selects a video file
  hideUpload?: boolean;                                                                     // hide the upload button?
  onDelete?: (type: "video", id: number) => void;                                           // runs when the user requests to delete a video
  
  onVideoSelect?: (videoData: any) => void;                                                 // runs when user selects a single video
  onMultipleVideoSelect?: (videoDataArray: any[]) => void;                                  // runs when user selects multiple videos
  externalModalOpen?: boolean;                                                              // to be deprecated — when set to true (rising edge only), displays the add video modal
  onExternalModalClose?: () => void;                                                        // to be deprecated — runs when user closes a modal
}

export default function Table({
  cameraId, camera, loadedVideos,
  onVideoFileSelect, hideUpload = false, onDelete, onVideoSelect, externalModalOpen, onExternalModalClose
}: TableProps) {
  const [handleOpenAddModal, setAddModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<VideoSummary[]>([]);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false, message: '', severity: 'success'
  });

  // const [loadedVideos, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // The single selected video (calendar supports one at a time)
  const selectedRow = selectedRows.length === 1 ? selectedRows[0] : null;

  useEffect(() => {
    if (externalModalOpen) {
      setAddModalOpen(true);
      onExternalModalClose?.(); 
    }
  }, [externalModalOpen]);

  // Auto-jump to the date of the most recent video on first load
  useEffect(() => {
    if (loadedVideos.length === 0) return;
    const parsed = loadedVideos.map(r => parseVideoTime(r)).filter(Boolean) as { dateKey: string; startHour: number }[];
    if (parsed.length === 0) return;
    const latestKey = parsed.map(p => p.dateKey).sort().at(-1)!;
    setCurrentDate(new Date(latestKey + 'T12:00:00'));
  }, [loadedVideos]);

  // ----------------- Handlers for Add/Edit/Delete actions -----------------
  // deletes the currently selected object
  const handleDelete = () => {
    if (!selectedRow) return;
    onDelete("video", selectedRow.id ?? -1);
  }

  
  /*
  const handleDelete = () => {
    if (selectedRows.length === 0) {
      alert('Please select at least one video to delete');
      return;
    }


    // setDeleteDialogOpen(true);
  };

  const handleEditCalibration = () => {
    if (selectedRows.length !== 1) {
      alert('Please select exactly one video to edit calibration');
      return;
    }

    const video = selectedRows[0];
    setEditCalibrationVideoId(video.id);
    setEditCalibrationData({
      calibration_points: video.calibration_points || [],
      reference_points: video.reference_points || [],
      reference_distance_meters: video.reference_distance_meters,
      thumbnail: video.thumbnail || null,
    });
    setEditCalibrationModalOpen(true);
  };

  const handleEditCalibrationSubmit = async (data: Record<string, unknown>) => {
    if (!editCalibrationVideoId) {
      setSnackbar({ open: true, message: 'Error: No video selected for calibration edit', severity: 'error' });
      return;
    }

    try {
      const patchData: Record<string, unknown> = {
        calibration_points: data.calibration_points,
        reference_points: data.reference_points,
        reference_distance_meters: data.reference_distance_meters,
      };

      const response = await authFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/videos/${editCalibrationVideoId}/`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchData),
        }
      );

      if (response.ok) {
        setSnackbar({ open: true, message: 'Calibration updated successfully', severity: 'success' });
        setEditCalibrationModalOpen(false);
        fetchVideos();
      } else {
        const errorData = await response.json();
        setSnackbar({ open: true, message: `Failed to update calibration: ${errorData.detail || 'Unknown error'}`, severity: 'error' });
      }
    } catch (error) {
      console.error('Error updating calibration:', error);
      setSnackbar({ open: true, message: `Error updating calibration: ${error instanceof Error ? error.message : 'Unknown error'}`, severity: 'error' });
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      const deletePromises = selectedRows.map(row =>
        authFetch(`${process.env.NEXT_PUBLIC_API_URL}/api/videos/${row.id}/`, { method: 'DELETE' })
      );

      const results = await Promise.all(deletePromises);
      const successCount = results.filter(r => r.ok).length;

      if (successCount === selectedRows.length) {
        setSnackbar({ open: true, message: `Successfully deleted ${successCount} video${successCount > 1 ? 's' : ''}`, severity: 'success' });
      } else {
        setSnackbar({ open: true, message: `Deleted ${successCount} of ${selectedRows.length} videos`, severity: 'warning' });
      }

      setDeleteDialogOpen(false);
      setSelectedRows([]);
      fetchVideos();
      if (onUploadComplete) onUploadComplete();
    } catch (error) {
      console.error('Error deleting videos:', error);
      setSnackbar({ open: true, message: 'Error deleting videos', severity: 'error' });
      setDeleteDialogOpen(false);
    }
  };
  */

  // ----------- Calendar Render ----------------

  const dateKey = toDateKey(currentDate);
  const hours = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
  const gridHeight = (HOUR_END - HOUR_START) * HOUR_HEIGHT;

  const todayBlocks = layoutDayBlocks(
    loadedVideos
      .map(row => { const t = parseVideoTime(row); return t ? { row, ...t } : null; })
      .filter((b): b is { row: any; dateKey: string; startHour: number } => b !== null && b.dateKey === dateKey)
  );

  return (
    <Box>
      <div className="table-container">

        {/* ----------- Calendar header --------------- */}
        <div className="cal-header">
          <div className="cal-header__nav">
            <button className="cal-nav-btn" onClick={() => setCurrentDate(d => addDays(d, -1))} aria-label="Previous day">
              <ChevronLeftIcon sx={{ fontSize: 18 }} />
            </button>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker
                value={dayjs(currentDate)}
                onChange={(val: Dayjs | null) => { if (val && val.isValid()) setCurrentDate(val.toDate()); }}
                slotProps={{
                  textField: {
                    size: 'small',
                    inputProps: { readOnly: true },
                    sx: {
                      width: 147,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontFamily: "'Roboto Mono', 'DM Mono', monospace",
                        fontWeight: 500,
                        cursor: 'pointer',
                        '& fieldset': { borderColor: '#e0e0e0' },
                        '&:hover fieldset': { borderColor: '#bdbdbd' },
                      },
                      '& .MuiInputBase-input': { padding: '5px 4px 5px 10px', cursor: 'pointer' },
                      '& .MuiInputAdornment-root .MuiIconButton-root': { padding: '4px' },
                    },
                  },
                }}
              />
            </LocalizationProvider>
            <button className="cal-nav-btn" onClick={() => setCurrentDate(d => addDays(d, 1))} aria-label="Next day">
              <ChevronRightIcon sx={{ fontSize: 18 }} />
            </button>
          </div>

          {todayBlocks.length === 0 && !loading && (
            <span className="cal-header__empty-note">No videos recorded for this day</span>
          )}

          {!hideUpload && (
            <div className="cal-header__actions">
              {/*<button className="cal-icon-btn" title="Upload video" aria-label="Upload video" onClick={() => setAddModalOpen(true)}>
                <FileUploadIcon sx={{ fontSize: 17 }} />
              </button>
               <button className="cal-icon-btn" title="Edit calibration" aria-label="Edit calibration" disabled={!selectedRow} onClick={handleEditCalibration}>
                <TuneIcon sx={{ fontSize: 17 }} />
              </button>
              <button className="cal-icon-btn" title="Rename video" aria-label="Rename video" disabled={!selectedRow} onClick={handleEdit}>
                <EditIcon sx={{ fontSize: 17 }} />
              </button> */}
              <button className="cal-icon-btn cal-icon-btn--danger" title="Delete video" aria-label="Delete video" disabled={!selectedRow} onClick={handleDelete}>
                <DeleteIcon sx={{ fontSize: 17 }} />
              </button>
            </div>
          )}
        </div>

        {/* ── Calendar grid ── */}
        <div className="cal-grid-scroll">
          {loading ? (
            <div className="cal-empty">Loading videos…</div>
          ) : (
            <div className="cal-grid">
              {/* Time labels */}
              <div className="cal-times">
                {hours.map(h => (
                  <div key={h} className="cal-time-slot" style={{ height: `${HOUR_HEIGHT}px` }}>
                    <span className="cal-time-label">{formatHourLabel(h)}</span>
                  </div>
                ))}
              </div>

              {/* Events column */}
              <div className="cal-events" style={{ height: `${gridHeight}px` }}>
                {hours.map(h => (
                  <div
                    key={h}
                    className="cal-hour-line"
                    style={{ top: `${(h - HOUR_START) * HOUR_HEIGHT}px` }}
                  />
                ))}

                {/* {todayBlocks.length === 0 && (
                  <div className="cal-empty cal-empty--inline">No videos recorded for this day</div>
                )} */}

                {todayBlocks.map(({ row, startHour, col, colCount }) => (
                  <SessionBlock
                    key={row.id}
                    row={row}
                    startHour={startHour}
                    col={col}
                    colCount={colCount}
                    selected={selectedRow?.id === row.id}
                    onClick={() => {
                      const newSelection = selectedRow?.id === row.id ? [] : [row];
                      setSelectedRows(newSelection);
                      if (onVideoSelect) onVideoSelect(newSelection.length ? row : null);
                    }}
                    onPlay={(e) => {
                      e.stopPropagation();
                      if (row.thumbnail) onVideoFileSelect(row.thumbnail, row.thumbnail);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedRow && (
          <Box
            sx={{
              mt: 1.5,
              border: '1px solid #e7e9f3',
              borderRadius: '12px',
              p: 1.5,
              backgroundColor: '#fafbff',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 1,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6a708d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Recorded At
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1d1f3f' }}>
                {selectedRow.recorded_time_string || 'N/A'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6a708d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Duration
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1d1f3f' }}>
                {selectedRow.duration}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6a708d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Source
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1d1f3f' }}>
                {formatMetadataSource(selectedRow.start_time_source)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#6a708d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Uploaded At
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1d1f3f' }}>
                {selectedRow.uploaded_time_string || 'N/A'}
              </Typography>
            </Box>
          </Box>
        )}

      </div>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}