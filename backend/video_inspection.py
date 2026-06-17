import json
import re
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any


def extract_creation_time_from_metadata(file_path: str) -> Optional[str]:
    """
    Extract creation_time from video container metadata using ffprobe.
    Returns ISO 8601 string or None if not available.
    """
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "format=creation_time",
                "-of", "default=noprint_wrappers=1:nokey=1:noprint_wrappers=1",
                file_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        creation_time = result.stdout.strip()
        if creation_time and creation_time != "N/A":
            return creation_time
    except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
        pass
    
    return None


def extract_duration_from_metadata(file_path: str) -> Optional[float]:
    """
    Extract duration from video container metadata using ffprobe.
    Returns duration in seconds or None if not available.
    """
    try:
        result = subprocess.run(
            [
                "ffprobe",
                "-v", "error",
                "-select_streams", "v:0",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                file_path
            ],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        duration_str = result.stdout.strip()
        if duration_str and duration_str != "N/A":
            return float(duration_str)
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError, Exception):
        pass
    
    return None


def parse_datetime_from_filename(filename: str) -> Optional[str]:
    """
    Parse filename for explicit date/time patterns.
    Supports patterns like:
    - 2024-12-25T14-30-45
    - 2024_12_25_14_30_45
    - 20241225_143045
    - 2024-12-25 14-30-45
    - 2024.12.25 14.30.45
    Returns ISO 8601 string or None if no pattern matched.
    """
    # Remove file extension
    name_without_ext = Path(filename).stem
    
    patterns = [
        # ISO-like: 2024-12-25T14-30-45 or 2024-12-25T14_30_45
        (r"(\d{4})-(\d{2})-(\d{2})[T_\s](\d{2})[-_:](\d{2})[-_:](\d{2})", "iso"),
        # Underscore: 2024_12_25_14_30_45
        (r"(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})", "underscore"),
        # Compact: 20241225_143045 or 20241225143045
        (r"(\d{4})(\d{2})(\d{2})[-_]?(\d{2})(\d{2})(\d{2})", "compact"),
        # Dot separated: 2024.12.25 14.30.45
        (r"(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2})\.(\d{2})\.(\d{2})", "dot"),
        # Spaced: 2024-12-25 14-30-45
        (r"(\d{4})-(\d{2})-(\d{2})\s+(\d{2})-(\d{2})-(\d{2})", "spaced"),
    ]
    
    for pattern, pattern_type in patterns:
        match = re.search(pattern, name_without_ext)
        if match:
            try:
                if pattern_type == "iso":
                    year, month, day, hour, minute, second = match.groups()
                elif pattern_type == "underscore":
                    year, month, day, hour, minute, second = match.groups()
                elif pattern_type == "compact":
                    year, month, day, hour, minute, second = match.groups()
                elif pattern_type == "dot":
                    year, month, day, hour, minute, second = match.groups()
                elif pattern_type == "spaced":
                    year, month, day, hour, minute, second = match.groups()
                
                dt = datetime(int(year), int(month), int(day), 
                             int(hour), int(minute), int(second))
                return dt.isoformat()
            except (ValueError, IndexError):
                continue
    
    return None


def normalize_to_iso8601(timestamp: Optional[str]) -> Optional[str]:
    """
    Normalize a timestamp string to ISO 8601 format.
    Handles various input formats:
    - ISO 8601 strings (already formatted)
    - UTC timestamps with 'Z'
    - Timestamps with timezone info
    """
    if not timestamp:
        return None
    
    timestamp = str(timestamp).strip()
    
    # If already ISO 8601 format, return as is
    if re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}", timestamp):
        return timestamp
    
    # Try parsing common formats
    formats = [
        "%Y-%m-%dT%H:%M:%S.%fZ",      # 2024-12-25T14:30:45.123Z
        "%Y-%m-%dT%H:%M:%SZ",          # 2024-12-25T14:30:45Z
        "%Y-%m-%d %H:%M:%S.%f",        # 2024-12-25 14:30:45.123
        "%Y-%m-%d %H:%M:%S",           # 2024-12-25 14:30:45
        "%Y-%m-%dT%H:%M:%S",           # 2024-12-25T14:30:45
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(timestamp, fmt)
            return dt.isoformat()
        except ValueError:
            continue
    
    return timestamp  # Return as-is if no format matched


def inspect_video(file_path: str) -> Dict[str, Any]:
    """
    Inspect video file and extract metadata with fallback to filename parsing.
    
    Returns raw JSON object:
    {
        "start_time": "ISO_8601_STRING_OR_NULL",
        "duration_seconds": float,
        "source": "metadata" | "filename" | "failed"
    }
    """
    result = {
        "start_time": None,
        "duration_seconds": None,
        "source": "failed"
    }
    
    if not Path(file_path).exists():
        return result
    
    # Try to extract from container metadata
    creation_time = extract_creation_time_from_metadata(file_path)
    duration = extract_duration_from_metadata(file_path)
    
    if creation_time:
        normalized_time = normalize_to_iso8601(creation_time)
        result["start_time"] = normalized_time
        result["source"] = "metadata"
    
    # Fallback to filename parsing if creation_time is None
    if not creation_time:
        filename = Path(file_path).name
        parsed_time = parse_datetime_from_filename(filename)
        if parsed_time:
            result["start_time"] = parsed_time
            result["source"] = "filename"
    
    # Always include duration if available
    if duration is not None:
        result["duration_seconds"] = duration
    
    return result


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        video_file = sys.argv[1]
        inspection_result = inspect_video(video_file)
        print(json.dumps(inspection_result))
