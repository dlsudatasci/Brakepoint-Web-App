from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from django.contrib.auth import authenticate
from django.db.models import Sum
from django.db.models.functions import TruncDate
from django.http import JsonResponse
from django.utils.dateparse import parse_datetime
from django.utils import timezone

from rest_framework_simplejwt.tokens import RefreshToken

import json
import importlib
import requests
import tempfile
import os
import sys
import traceback

from .models import SavedLocation, Camera, Video
from .serializers import (
    SavedLocationSerializer,
    SignupSerializer,
    CameraSerializer,
    VideoSerializer,
)

from .polygon_validators import (
    validate_geometry,
    is_degenerate,
    is_self_intersecting,
    polygon_within_polygon,
)

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    yolo_processor_module = importlib.import_module("yolo_processor")
    sign_processor_module = importlib.import_module("mask_rcnn_detectron2_processor")

    run_detection_on_video = yolo_processor_module.run_detection_on_video
    run_traffic_sign_detection_on_video = sign_processor_module.run_traffic_sign_detection_on_video
    detect_signs_on_first_frame_of_video = sign_processor_module.detect_signs_on_first_frame_of_video
    detect_signs_on_image_bytes = sign_processor_module.detect_signs_on_image_bytes
    DETECTRON2_AVAILABLE = sign_processor_module.DETECTRON2_AVAILABLE
except ImportError:  # pragma: no cover — ML packages not installed in CI
    def run_detection_on_video(*a, **kw): return {"status": "error", "error": "YOLO not available"}
    def run_traffic_sign_detection_on_video(*a, **kw): return {"status": "error"}
    def detect_signs_on_first_frame_of_video(*a, **kw): return {}
    def detect_signs_on_image_bytes(*a, **kw): return {}
    DETECTRON2_AVAILABLE = False

try:
    inspect_video = importlib.import_module("video_inspection").inspect_video
except ImportError:  # pragma: no cover — ML packages not installed in CI
    def inspect_video(*a, **kw):
        return {"start_time": None, "duration_seconds": None, "source": "failed"}

ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
MAX_VIDEO_SIZE_MB = 500


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _extract_bearer_token(request):
    auth_header = request.META.get("HTTP_AUTHORIZATION", "")
    if isinstance(auth_header, str) and auth_header.lower().startswith("bearer "):
        return auth_header.split(" ", 1)[1].strip()

    fallback = request.META.get("HTTP_X_MODEL_SERVICE_TOKEN") or request.META.get("HTTP_X_SHARED_TOKEN")
    if isinstance(fallback, str):
        return fallback.strip()
    return ""


def _get_model_service_settings():
    enabled = _as_bool(os.getenv("MODEL_SERVICE_ENABLED"), default=False)
    submit_url = os.getenv("MODEL_SERVICE_SUBMIT_URL", "").strip()
    shared_token = os.getenv("MODEL_SERVICE_SHARED_TOKEN", "").strip()
    callback_token = os.getenv("MODEL_SERVICE_CALLBACK_TOKEN", "").strip()
    callback_base_url = os.getenv("MODEL_CALLBACK_BASE_URL", "").strip()

    # If URL is provided, assume remote mode should be active.
    if submit_url and not enabled:
        enabled = True

    return {
        "enabled": enabled,
        "submit_url": submit_url,
        "shared_token": shared_token,
        "callback_token": callback_token,
        "callback_base_url": callback_base_url,
    }


def _build_model_callback_url(request, callback_base_url):
    callback_path = "/api/model-results-callback/"
    if callback_base_url:
        return f"{callback_base_url.rstrip('/')}{callback_path}"
    return request.build_absolute_uri(callback_path)


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default=None):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _normalize_callback_payload(payload):
    data = payload if isinstance(payload, dict) else {}
    results = data.get("results") if isinstance(data.get("results"), dict) else {}

    status_val = str(data.get("status") or results.get("status") or "").strip().lower()
    if status_val in {"ok", "success", "completed", "complete", "done"}:
        normalized_status = "completed"
    elif status_val in {"failed", "error", "failure"}:
        normalized_status = "failed"
    elif status_val in {"processing", "running", "queued", "pending"}:
        normalized_status = "processing"
    else:
        normalized_status = "processing"

    video_id = data.get("video_id") or results.get("video_id")
    yolo_progress = data.get("yolo_progress", results.get("yolo_progress", 100 if normalized_status == "completed" else 0))

    normalized = {
        "video_id": _safe_int(video_id, default=0),
        "status": normalized_status,
        "error": str(data.get("error") or results.get("error") or ""),
        "vehicles": _safe_int(data.get("vehicles", results.get("vehicles")), default=0),
        "speeding_count": _safe_int(data.get("speeding_count", results.get("speeding_count")), default=0),
        "swerving_count": _safe_int(data.get("swerving_count", results.get("swerving_count")), default=0),
        "abrupt_stopping_count": _safe_int(data.get("abrupt_stopping_count", results.get("abrupt_stopping_count")), default=0),
        "vehicle_breakdown": data.get("vehicle_breakdown", results.get("vehicle_breakdown", {})),
        "meter_per_pixel": _safe_float(data.get("meter_per_pixel", results.get("meter_per_pixel")), default=None),
        "jeepney_hotspot": bool(data.get("jeepney_hotspot", results.get("jeepney_hotspot", False))),
        "duration_seconds": _safe_float(data.get("duration_seconds", results.get("duration_seconds")), default=None),
        "fps": _safe_float(data.get("fps", results.get("fps")), default=None),
        "resolution": data.get("resolution", results.get("resolution")),
        "thumbnail": data.get("thumbnail", results.get("thumbnail")),
        "yolo_progress": max(0, min(100, _safe_int(yolo_progress, default=0))),
    }

    sign_breakdown = data.get("sign_breakdown", results.get("sign_breakdown", {}))
    if isinstance(sign_breakdown, dict):
        normalized["sign_breakdown"] = sign_breakdown
    else:
        normalized["sign_breakdown"] = {}

    sign_classes = data.get("sign_classes", results.get("sign_classes"))
    if isinstance(sign_classes, list):
        normalized["sign_classes"] = [str(x) for x in sign_classes]
    else:
        normalized["sign_classes"] = list(normalized["sign_breakdown"].keys())

    normalized["signs"] = _safe_int(
        data.get("signs", results.get("signs", len(normalized["sign_classes"]))),
        default=0,
    )
    return normalized
api_view(['GET'])
@permission_classes([AllowAny])
def home(request):
    return Response({
        "message": "Welcome to BrakePoint API backend. Frontend handled by Next.js."
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def dashboard(request):
    locations = SavedLocation.objects.all().order_by('-id')
    serializer = SavedLocationSerializer(locations, many=True)
    return Response({
        "view": "dashboard",
        "locations": serializer.data
    })

@api_view(['GET'])
@permission_classes([AllowAny])
def examine(request):
    # You can later return saved polygons/cameras if you store them
    return Response({
        "view": "examine",
        "message": "Map editing and viewing handled by Next.js frontend."
    })

# ---- Log In and Sign Up ----

api_view(['GET', 'POST'])
permission_classes([AllowAny])
def sign_up(request):
    if request.method == 'GET':
         return
    if request.method == 'POST':
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')
    

# ---- SavedLocations ----
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def saved_locations_list_create(request):
    if request.method == "GET":
        try:
            location_type = request.query_params.get("type")
            parent_id = request.query_params.get("parent_id")

            qs = SavedLocation.objects.filter(user=request.user)

            if location_type:
                qs = qs.filter(location_type=location_type)

            if parent_id:
                qs = qs.filter(parent_id=parent_id)

            sub_area_type = request.query_params.get("sub_area_type")
            if sub_area_type:
                qs = qs.filter(sub_area_type=sub_area_type)

            payload = []
            for loc in qs:
                payload.append({
                    "id": loc.id,
                    "name": loc.name,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "zoom": loc.zoom,
                    "bearing": loc.bearing,
                    "pitch": loc.pitch,
                    "geometry": loc.geometry,
                    "bounds": loc.bounds,
                    "location_type": loc.location_type,
                    "sub_area_type": loc.sub_area_type,
                    "parent_id": loc.parent_id,
                    "camera_count": loc.camera_count,
                    "vehicles": loc.total_vehicles,
                    "occurrences": loc.total_occurrences,
                    "speeding": loc.total_speeding,
                    "swerving": loc.total_swerving,
                    "abrupt_stopping": loc.total_abrupt_stopping,
                    "behaviors": loc.behavior_summary,
                    "vehicle_breakdown": loc.total_vehicle_breakdown,
                })

            return Response({"success": True, "saved_locations": payload})

        except Exception as e:
            traceback.print_exc()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    if request.method == "POST":
        try:
            body = request.data

            if "lat" not in body or "lng" not in body:
                return Response(
                    {"success": False, "error": "lat and lng are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            parent_id = body.get("parent_id")
            if parent_id is not None:
                exists = SavedLocation.objects.filter(
                    id=parent_id,
                    user=request.user,
                ).exists()
                if not exists:
                    return Response(
                        {"success": False, "error": "Parent saved location not found"},
                        status=status.HTTP_404_NOT_FOUND,
                    )

            # Polygon geometry validation
            raw_geometry = body.get("geometry")
            if raw_geometry is not None:
                try:
                    ring = validate_geometry(raw_geometry)
                except ValueError as ve:
                    return Response(
                        {"success": False, "error": str(ve)},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if is_degenerate(ring):
                    return Response(
                        {"success": False, "error": "Polygon has zero or near-zero area (degenerate)"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                if is_self_intersecting(ring):
                    return Response(
                        {"success": False, "error": "Polygon is self-intersecting"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                location_type = body.get("location_type", "sub_area")
                if location_type == "sub_area" and parent_id is not None:
                    try:
                        parent = SavedLocation.objects.get(id=parent_id, user=request.user)
                        if parent.geometry:
                            try:
                                parent_ring = validate_geometry(parent.geometry)
                                if not polygon_within_polygon(ring, parent_ring):
                                    return Response(
                                        {"success": False, "error": "sub-area must be within main AOI"},
                                        status=status.HTTP_400_BAD_REQUEST,
                                    )
                            except ValueError:
                                pass  
                    except SavedLocation.DoesNotExist:
                        pass  

            loc = SavedLocation.objects.create(
                user=request.user,
                name=body.get("name", "Untitled Area"),
                lat=body["lat"],
                lng=body["lng"],
                zoom=body.get("zoom", 17.0),
                bearing=body.get("bearing", 0.0),
                pitch=body.get("pitch", 0.0),
                geometry=body.get("geometry"),
                bounds=body.get("bounds"),
                location_type=body.get("location_type", "sub_area"),
                sub_area_type=body.get("sub_area_type"),
                parent_id=parent_id,
            )

            return Response(
                {
                    "success": True,
                    "saved_location": {
                        "id": loc.id,
                        "name": loc.name,
                        "lat": loc.lat,
                        "lng": loc.lng,
                        "zoom": loc.zoom,
                        "bearing": loc.bearing,
                        "pitch": loc.pitch,
                        "geometry": loc.geometry,
                        "bounds": loc.bounds,
                        "location_type": loc.location_type,
                        "sub_area_type": loc.sub_area_type,
                        "parent_id": loc.parent_id,
                    },
                },
                status=status.HTTP_201_CREATED,
            )

        except Exception as e:
            traceback.print_exc()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
    if request.method == "GET":
        try:
            location_type = request.GET.get("type")
            parent_id = request.GET.get("parent_id")

            qs = SavedLocation.objects.filter(user=request.user)

            if location_type:
                qs = qs.filter(location_type=location_type)

            if parent_id:
                qs = qs.filter(parent_id=parent_id)

            sub_area_type_filter = request.GET.get("sub_area_type")
            if sub_area_type_filter:
                qs = qs.filter(sub_area_type=sub_area_type_filter)

            payload = []
            for loc in qs:
                payload.append({
                    "id": loc.id,
                    "name": loc.name,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "zoom": loc.zoom,
                    "bearing": loc.bearing,
                    "pitch": loc.pitch,
                    "geometry": loc.geometry,
                    "bounds": loc.bounds,
                    "location_type": loc.location_type,
                    "sub_area_type": loc.sub_area_type,
                    "parent_id": loc.parent_id,
                    "camera_count": loc.camera_count,
                    "vehicles": loc.total_vehicles,
                    "occurrences": loc.total_occurrences,
                    "speeding": loc.total_speeding,
                    "swerving": loc.total_swerving,
                    "abrupt_stopping": loc.total_abrupt_stopping,
                    "behaviors": loc.behavior_summary,
                    "vehicle_breakdown": loc.total_vehicle_breakdown,
                })

            return JsonResponse({"success": True, "saved_locations": payload})

        except Exception as e:
            print("GET /saved-locations/ failed:")
            traceback.print_exc()
            return JsonResponse(
                {"success": False, "error": str(e)},
                status=500,
            )

    if request.method == "POST":
        try:
            body = json.loads(request.body or "{}")

            print("POST /saved-locations/ body:", body)
            print("Authenticated user:", request.user, request.user.is_authenticated)

            if "lat" not in body or "lng" not in body:
                return JsonResponse(
                    {"success": False, "error": "lat and lng are required"},
                    status=400,
                )

            parent_id = body.get("parent_id")
            if parent_id is not None:
                exists = SavedLocation.objects.filter(id=parent_id, user=request.user).exists()
                if not exists:
                    return JsonResponse(
                        {"success": False, "error": "Parent saved location not found"},
                        status=404,
                    )

            loc = SavedLocation.objects.create(
                user=request.user,
                name=body.get("name", "Untitled Area"),
                lat=body["lat"],
                lng=body["lng"],
                zoom=body.get("zoom", 17.0),
                bearing=body.get("bearing", 0.0),
                pitch=body.get("pitch", 0.0),
                geometry=body.get("geometry"),
                bounds=body.get("bounds"),
                location_type=body.get("location_type", "sub_area"),
                sub_area_type=body.get("sub_area_type"),
                parent_id=parent_id,
            )

            return JsonResponse({
                "success": True,
                "saved_location": {
                    "id": loc.id,
                    "name": loc.name,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "zoom": loc.zoom,
                    "bearing": loc.bearing,
                    "pitch": loc.pitch,
                    "geometry": loc.geometry,
                    "bounds": loc.bounds,
                    "location_type": loc.location_type,
                    "sub_area_type": loc.sub_area_type,
                    "parent_id": loc.parent_id,
                }
            }, status=201)

        except Exception as e:
            print("POST /saved-locations/ failed:")
            traceback.print_exc()
            return JsonResponse(
                {"success": False, "error": str(e)},
                status=500,
            )

    return JsonResponse({"success": False, "error": "Method not allowed"}, status=405)

@api_view(["GET", "PATCH", "PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def saved_location_detail(request, saved_location_id):
    try:
        loc = SavedLocation.objects.get(id=saved_location_id, user=request.user)
    except SavedLocation.DoesNotExist:
        return Response(
            {"success": False, "error": "Saved location not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    if request.method == "GET":
        return Response({
            "success": True,
            "saved_location": {
                "id": loc.id,
                "name": loc.name,
                "lat": loc.lat,
                "lng": loc.lng,
                "zoom": loc.zoom,
                "bearing": loc.bearing,
                "pitch": loc.pitch,
                "geometry": loc.geometry,
                "bounds": loc.bounds,
                "location_type": loc.location_type,
                "sub_area_type": loc.sub_area_type,
                "parent_id": loc.parent_id,
                "camera_count": loc.camera_count,
                "vehicles": loc.total_vehicles,
                "occurrences": loc.total_occurrences,
                "speeding": loc.total_speeding,
                "swerving": loc.total_swerving,
                "abrupt_stopping": loc.total_abrupt_stopping,
                "behaviors": loc.behavior_summary,
            }
        })

    if request.method in ["PATCH", "PUT"]:
        try:
            body = request.data

            loc.name = body.get("name", loc.name)
            loc.lat = body.get("lat", loc.lat)
            loc.lng = body.get("lng", loc.lng)
            loc.zoom = body.get("zoom", loc.zoom)
            loc.bearing = body.get("bearing", loc.bearing)
            loc.pitch = body.get("pitch", loc.pitch)
            loc.geometry = body.get("geometry", loc.geometry)
            loc.bounds = body.get("bounds", loc.bounds)
            loc.location_type = body.get("location_type", loc.location_type)
            loc.sub_area_type = body.get("sub_area_type", loc.sub_area_type)

            if "parent_id" in body:
                new_parent_id = body.get("parent_id")
                if new_parent_id is None:
                    loc.parent_id = None
                else:
                    exists = SavedLocation.objects.filter(
                        id=new_parent_id,
                        user=request.user,
                    ).exists()
                    if not exists:
                        return Response(
                            {"success": False, "error": "Parent saved location not found"},
                            status=status.HTTP_404_NOT_FOUND,
                        )
                    loc.parent_id = new_parent_id

            loc.save()
            return Response({"success": True})

        except Exception as e:
            traceback.print_exc()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    if request.method == "DELETE":
        try:
            SavedLocation.objects.filter(user=request.user, parent_id=loc.id).delete()
            loc.delete()
            return Response({"success": True})
        except Exception as e:
            traceback.print_exc()
            return Response(
                {"success": False, "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
            
@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def assign_camera_to_saved_location(request, camera_id):
    try:
        camera = Camera.objects.get(id=camera_id, user=request.user)
    except Camera.DoesNotExist:
        return Response(
            {"success": False, "error": "Camera not found"},
            status=status.HTTP_404_NOT_FOUND,
        )

    try:
        saved_location_id = request.data.get("saved_location_id")

        if saved_location_id is None:
            camera.saved_location = None
            camera.save()
            return Response({"success": True})

        try:
            loc = SavedLocation.objects.get(id=saved_location_id, user=request.user)
        except SavedLocation.DoesNotExist:
            return Response(
                {"success": False, "error": "Saved location not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        camera.saved_location = loc
        camera.save()

        return Response({"success": True})

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
        
# Auth
@api_view(['GET'])
@permission_classes([AllowAny])
def get_csrf_token(request):
    from django.middleware.csrf import get_token
    return Response({"csrfToken": get_token(request)})

@api_view(['GET'])
@permission_classes([AllowAny])
def check_auth(request):
    if request.user.is_authenticated:
        return Response({
            "authenticated": True,
            "user": {"username": request.user.username, "id": request.user.id}
        })
    return Response({"authenticated": False})

@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    from rest_framework_simplejwt.tokens import RefreshToken
    
    username = request.data.get('username')
    password = request.data.get('password')
    user = authenticate(request, username=username, password=password)
    
    if not user:
        return Response({"success": False, "error": "Invalid credentials"}, status=400)
    
    # Generate JWT tokens
    refresh = RefreshToken.for_user(user)
    
    return Response({
        "success": True,
        "user": {"username": user.username, "id": user.id},
        "access": str(refresh.access_token),
        "refresh": str(refresh)
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def api_signup(request):
    ser = SignupSerializer(data=request.data)
    if ser.is_valid():
        ser.save()
        return Response({"success": True})
    return Response({"success": False, "error": ser.errors}, status=400)

def get_location_name(lat, lng):
    """Get location name from coordinates using Nominatim API"""
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lng}&zoom=18&addressdetails=1"
        headers = {'User-Agent': 'BrakePoint/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.ok:
            data = response.json()
            address = data.get('address', {})
    
            parts = []
            if address.get('road'):
                parts.append(address['road'])
            if address.get('suburb') or address.get('neighbourhood'):
                parts.append(address.get('suburb') or address.get('neighbourhood'))
            if address.get('city') or address.get('town') or address.get('municipality'):
                parts.append(address.get('city') or address.get('town') or address.get('municipality'))
            if address.get('country'):
                parts.append(address['country'])
            
            return ', '.join(parts) if parts else data.get('display_name', '')
    except Exception as e:
        print(f"Reverse geocoding failed: {e}")
    
    return None

# Cameras
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])  
def cameras_api(request):
    user = request.user 
    print(f"Camera API called - User: {user.username}, Authenticated: {request.user.is_authenticated}")
    
    if request.method == 'GET':
        cameras = Camera.objects.filter(user=user)
        ser = CameraSerializer(cameras, many=True)
        return Response({"success": True, "cameras": ser.data})
    
    data = request.data.copy()
    lat_raw = data.get('lat')
    lng_raw = data.get('lng')
    if lat_raw is None or lng_raw is None:
        return Response({'error': 'lat and lng are required'}, status=400)
    try:
        lat = float(lat_raw)
        lng = float(lng_raw)
    except (ValueError, TypeError):
        return Response({'error': 'lat and lng must be valid numbers'}, status=400)
    
    location_name = get_location_name(lat, lng)
    
    if not data.get('name'):
        if location_name:
            parts = location_name.split(',')
            data['name'] = f"{parts[0].strip()} Camera" if parts else f"Camera at {lat:.4f}°, {lng:.4f}°"
        else:
            data['name'] = f"Camera at {lat:.4f}°, {lng:.4f}°"
    
    if not data.get('location'):
        if location_name:
            data['location'] = location_name
        else:
            lat_dir = 'N' if lat >= 0 else 'S'
            lng_dir = 'E' if lng >= 0 else 'W'
            data['location'] = f"{abs(lat):.4f}°{lat_dir}, {abs(lng):.4f}°{lng_dir}"
    
    ser = CameraSerializer(data=data)
    if ser.is_valid():
        camera = ser.save(user=user)
        
        if not camera.saved_location:
            from math import radians, cos, sin, asin, sqrt
            
            def haversine(lat1, lng1, lat2, lng2):
                lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
                dlat = lat2 - lat1
                dlng = lng2 - lng1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
                return 6371000 * 2 * asin(sqrt(a))  
            
            nearest = None
            min_dist = float('inf')
            for loc in SavedLocation.objects.all():
                dist = haversine(lat, lng, loc.lat, loc.lng)
                if dist < min_dist:
                    min_dist = dist
                    nearest = loc
        
            if nearest and min_dist <= 500: 
                camera.saved_location = nearest
                camera.save()
        
        return Response({"success": True, "camera": CameraSerializer(camera).data}, status=201)
    return Response({"success": False, "error": ser.errors}, status=400)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def upload_and_process_video(request):
    """
    Receives uploaded video, saves temporarily, and runs both YOLO vehicle detection 
    and Mask R-CNN traffic sign detection with calibration.
    Creates a Video record linked to a Camera.
    """
    print(f"[upload] method={request.method} content_type={request.content_type} FILES={list(request.FILES.keys())} POST={list(request.POST.keys())} user={request.user}", flush=True)
    try:
        return _upload_and_process_video(request)
    except Exception as exc:
        import traceback
        traceback.print_exc()
        return Response({'error': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def _upload_and_process_video(request):
    user = request.user
    video_file = request.FILES.get('file')
    video_name = request.POST.get('video_name', 'Untitled Video')
    camera_id = request.POST.get('camera_id')
    is_dry_run = request.POST.get('is_dry_run', 'false').lower() == 'true'
    
    if not video_file:
        return Response({'error': 'No video file provided'}, status=status.HTTP_400_BAD_REQUEST)

    if not camera_id:
        return Response({'error': 'Camera ID is required'}, status=status.HTTP_400_BAD_REQUEST)

    # File format & size validation 
    _, ext = os.path.splitext(video_file.name or '')
    if ext.lower() not in ALLOWED_VIDEO_EXTENSIONS:
        allowed = ', '.join(sorted(ALLOWED_VIDEO_EXTENSIONS))
        return Response(
            {'error': f'Invalid file format "{ext or "(none)"}". Allowed: {allowed}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if video_file.size > MAX_VIDEO_SIZE_MB * 1024 * 1024:
        return Response(
            {'error': f'File too large. Maximum allowed size is {MAX_VIDEO_SIZE_MB} MB.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        camera = Camera.objects.get(pk=camera_id, user=user)
    except Camera.DoesNotExist:
        return Response({'error': 'Camera not found'}, status=status.HTTP_404_NOT_FOUND)

    calibration_points_json = request.POST.get('calibration_points')
    reference_points_json = request.POST.get('reference_points')
    reference_distance_str = request.POST.get('reference_distance_meters')
    use_sign_detection = request.POST.get('use_sign_detection', 'false').lower() == 'true'
    
    calibration_points = None
    reference_points = None
    reference_distance_meters = None
    
    if calibration_points_json:
        calibration_points = json.loads(calibration_points_json)
    
    if reference_points_json:
        reference_points = json.loads(reference_points_json)
    
    if reference_distance_str:
        try:
            reference_distance_meters = float(reference_distance_str)
        except ValueError:
            return Response({'error': 'Invalid reference distance value'}, status=status.HTTP_400_BAD_REQUEST)

    if not calibration_points and camera.is_calibrated:
        calibration_points = camera.calibration_points
    if not reference_points and camera.is_calibrated:
        reference_points = camera.reference_points
    if reference_distance_meters is None and camera.is_calibrated:
        reference_distance_meters = camera.reference_distance_meters

    save_calibration = request.POST.get('save_calibration', 'true').lower() == 'true'
    if save_calibration and calibration_points_json:
        camera.calibration_points = calibration_points or []
        camera.reference_points = reference_points or []
        camera.reference_distance_meters = reference_distance_meters
        camera.is_calibrated = True
        camera.save()

    video_record = Video.objects.create(
        camera=camera,
        filename=video_name,
        calibration_points=calibration_points or [],
        reference_points=reference_points or [],
        reference_distance_meters=reference_distance_meters,
        start_time_source='failed',
        processing_status='processing',
        processing_started_at=timezone.now()
    )

    model_cfg = _get_model_service_settings()

    import re as _re
    _speed_limit = None
    if isinstance(camera.tags, list):
        for _tag in camera.tags:
            _m = _re.match(r'(\d+)\s*kph\s+speed\s+limit', str(_tag), _re.IGNORECASE)
            if _m:
                _speed_limit = int(_m.group(1))
                break

    project_tmp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tmp')
    os.makedirs(project_tmp, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", dir=project_tmp) as tmp_file:
        for chunk in video_file.chunks():
            tmp_file.write(chunk)
        temp_path = tmp_file.name

    # Remote pipeline mode: send the uploaded file to the model-service and return immediately.
    if model_cfg["enabled"]:
        if not model_cfg["submit_url"]:
            video_record.processing_status = 'failed'
            video_record.error_message = 'MODEL_SERVICE_ENABLED is true but MODEL_SERVICE_SUBMIT_URL is not configured'
            video_record.processing_completed_at = timezone.now()
            video_record.save(update_fields=['processing_status', 'error_message', 'processing_completed_at'])
            if os.path.exists(temp_path):
                os.remove(temp_path)
            return Response({'error': 'Model service is not configured on the backend'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        callback_url = _build_model_callback_url(request, model_cfg["callback_base_url"])

        form_data = {
            'video_id': str(video_record.id),
            'camera_id': str(camera.id),
            'callback_url': callback_url,
            'callback_token': model_cfg["callback_token"],
            'calibration_points': json.dumps(calibration_points or []),
            'reference_points': json.dumps(reference_points or []),
            'reference_distance_meters': '' if reference_distance_meters is None else str(reference_distance_meters),
            'use_sign_detection': 'true' if use_sign_detection else 'false',
            'speed_limit_kmh': '' if _speed_limit is None else str(_speed_limit),
        }

        headers = {}
        if model_cfg["shared_token"]:
            headers['Authorization'] = f"Bearer {model_cfg['shared_token']}"

        try:
            with open(temp_path, 'rb') as src:
                files = {'file': (video_file.name or f"video-{video_record.id}.mp4", src, video_file.content_type or 'video/mp4')}
                remote_resp = requests.post(
                    model_cfg["submit_url"],
                    data=form_data,
                    files=files,
                    headers=headers,
                    timeout=120,
                )

            if not remote_resp.ok:
                remote_error_text = remote_resp.text[:2000]
                video_record.processing_status = 'failed'
                video_record.error_message = f"Model service rejected request ({remote_resp.status_code}): {remote_error_text}"
                video_record.processing_completed_at = timezone.now()
                video_record.save(update_fields=['processing_status', 'error_message', 'processing_completed_at'])
                return Response(
                    {'error': 'Remote model service rejected the upload', 'details': remote_error_text},
                    status=status.HTTP_502_BAD_GATEWAY,
                )

            try:
                remote_payload = remote_resp.json()
            except ValueError:
                remote_payload = {'message': remote_resp.text[:500]}

            return Response(
                {
                    'success': True,
                    'video_id': video_record.id,
                    'camera_id': camera.id,
                    'message': remote_payload.get('message', 'Video uploaded successfully, remote processing started'),
                    'processing_status': 'processing',
                },
                status=status.HTTP_201_CREATED,
            )
        except requests.RequestException as exc:
            video_record.processing_status = 'failed'
            video_record.error_message = f"Could not reach model service: {exc}"
            video_record.processing_completed_at = timezone.now()
            video_record.save(update_fields=['processing_status', 'error_message', 'processing_completed_at'])
            return Response(
                {'error': 'Failed to submit video to model service', 'details': str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass
    
    try:
        import cv2
        import base64
        inspection_result = inspect_video(temp_path)

        if inspection_result.get('start_time'):
            parsed_start_time = parse_datetime(inspection_result['start_time'])
            if parsed_start_time is not None:
                if timezone.is_naive(parsed_start_time):
                    parsed_start_time = timezone.make_aware(parsed_start_time, timezone.get_current_timezone())
                video_record.start_time = parsed_start_time

        video_record.start_time_source = inspection_result.get('source') or 'failed'

        if inspection_result.get('duration_seconds') is not None:
            video_record.duration_seconds = inspection_result['duration_seconds']

        cap = cv2.VideoCapture(temp_path)
        if cap.isOpened():
            video_record.fps = cap.get(cv2.CAP_PROP_FPS)
            if video_record.duration_seconds is None:
                video_record.duration_seconds = cap.get(cv2.CAP_PROP_FRAME_COUNT) / video_record.fps if video_record.fps > 0 else 0
            frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            video_record.resolution = f"{frame_width}x{frame_height}"
            
            # Generate thumbnail from the first frame.
            try:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if ret and frame is not None:
                    max_width = 640
                    height, width = frame.shape[:2]
                    if width > max_width:
                        scale = max_width / width
                        new_width = max_width
                        new_height = int(height * scale)
                        frame = cv2.resize(frame, (new_width, new_height))
                    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
                    thumbnail_base64 = base64.b64encode(buffer).decode('utf-8')
                    video_record.thumbnail = f"data:image/jpeg;base64,{thumbnail_base64}"
            except Exception as thumb_error:
                print(f"[Error] Thumbnail generation failed: {thumb_error}", flush=True)
            
            cap.release()
        
        video_record.file_size_mb = os.path.getsize(temp_path) / (1024 * 1024)
        video_record.save()

        response_data = {
            'success': True,
            'video_id': video_record.id,
            'camera_id': camera.id,
            'message': 'Video uploaded successfully, processing started',
            'processing_status': 'processing'
        }
        
        import threading

        def process_video_background(is_dry_run):
            """Process video in background thread"""
            from django.db import connection
            import time
            
            connection.close()
            
            try:
                # Get fresh video instance
                video_obj = Video.objects.get(pk=video_record.id)
                
                # Run YOLO vehicle detection
                yolo_results = run_detection_on_video(
                    temp_path, 
                    calibration_points, 
                    reference_distance_meters,
                    reference_points,
                    video_record=video_obj,
                    speed_limit_kmh=_speed_limit
                )
    
                video_obj.refresh_from_db()
                
                sign_results = {}
                if use_sign_detection:
                    print(f"[views.py] Starting Mask R-CNN for video {video_obj.id}", flush=True)
                    sign_results = run_traffic_sign_detection_on_video(temp_path, video_record=video_obj)
                    print(f"[views.py] Mask R-CNN completed: {sign_results.get('status')}", flush=True)
                else:
                    print(f"[views.py] Skipping Mask R-CNN for video {video_obj.id} (not requested)", flush=True)

                connection.close()
                video_obj = Video.objects.get(pk=video_record.id)
                
                if yolo_results.get('status') == 'success':
                    video_obj.vehicles = yolo_results.get('total_unique', 0)
                    video_obj.speeding_count = yolo_results.get('total_speeding', 0)
                    video_obj.swerving_count = yolo_results.get('total_swerving', 0)
                    video_obj.abrupt_stopping_count = yolo_results.get('total_abrupt_stopping', 0)
                    video_obj.vehicle_breakdown = yolo_results.get('breakdown', {})
                    video_obj.meter_per_pixel = yolo_results.get('meter_per_pixel', None)
                    video_obj.jeepney_hotspot = yolo_results.get('jeepney_hotspot', False)

                    if is_dry_run:
                        camera.refresh_from_db()

                        camera.calibration_points = calibration_points or []
                        camera.reference_points = reference_points or []
                        camera.reference_distance_meters = reference_distance_meters
                        camera.meter_per_pixel = yolo_results.get('meter_per_pixel')
                        camera.is_calibrated = True
                        camera.save()
                
                if sign_results.get('status') == 'success':
                    video_obj.signs = sign_results.get('unique_signs', 0) 
                    sign_counts = sign_results.get('sign_counts', {})
                    video_obj.sign_classes = list(sign_counts.keys())
                    video_obj.sign_breakdown = sign_counts
                
                video_obj.processing_status = 'completed'
                video_obj.processing_completed_at = timezone.now()
                video_obj.save()
                print(f"[views.py] Processing completed for video {video_obj.id}", flush=True)
                
            except Exception as e:
                print(f"[Error] Video {video_record.id} processing failed: {e}", flush=True)
                import traceback
                traceback.print_exc()
                # Retry DB connection before saving failure state
                for _attempt in range(3):
                    try:
                        connection.close()
                        connection.ensure_connection()
                        video_obj = Video.objects.get(pk=video_record.id)
                        video_obj.processing_status = 'failed'
                        video_obj.processing_stage = ''
                        video_obj.yolo_progress = 0
                        video_obj.processing_completed_at = timezone.now()
                        video_obj.save()
                        print(f"[Error] Saved failure state for video {video_record.id}", flush=True)
                        break
                    except Exception as save_error:
                        print(f"[Error] Save attempt {_attempt+1} failed: {save_error}", flush=True)
                        import time
                        time.sleep(2)
            finally:
                # Clean up temp file
                if os.path.exists(temp_path):
                    try:
                        os.remove(temp_path)
                    except Exception as cleanup_error:
                        print(f"[Error] Could not delete temp file: {cleanup_error}", flush=True)
                connection.close()
        
        thread = threading.Thread(target=process_video_background, args=(is_dry_run,), daemon=True)
        thread.start()

    except Exception as e:
        video_record.processing_status = 'failed'
        video_record.error_message = str(e)
        video_record.processing_completed_at = timezone.now()
        video_record.save()
        
        response_data = {
            'success': False,
            'error': str(e),
            'video_id': video_record.id
        }

    return Response(response_data, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def camera_videos_api(request, pk: int):
    """Get all videos for a specific camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    videos = Video.objects.filter(camera=camera).order_by('-uploaded_at')
    ser = VideoSerializer(videos, many=True)
    
    return Response({"success": True, "videos": ser.data})

@api_view(['DELETE', 'PATCH'])
@permission_classes([IsAuthenticated]) 
def camera_delete_api(request, pk: int):
    user = request.user 
    print(f"Camera detail API called - Method: {request.method}, Camera ID: {pk}, User: {user.username}, Authenticated: {request.user.is_authenticated}")
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
        print(f"Camera found: {camera.id}, User: {camera.user.username}")
    except Camera.DoesNotExist:
        print(f"Camera not found with ID {pk} for user {user.username}")
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    if request.method == 'PATCH':
        name = request.data.get('name')
        if name is not None:
            name = str(name).strip()
            if not name:
                return Response({"success": False, "error": "Name cannot be empty"}, status=400)
            camera.name = name

        location = request.data.get('location')
        if location is not None:
            camera.location = str(location).strip()

        camera.save()
        return Response({"success": True, "camera": CameraSerializer(camera).data})

    camera.delete()
    return Response({"success": True})

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def camera_polygon_api(request, pk: int):
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    polygon_data = request.data.get('polygon')

    def _is_coord_pair(point):
        return (
            isinstance(point, (list, tuple))
            and len(point) == 2
            and isinstance(point[0], (int, float))
            and isinstance(point[1], (int, float))
        )

    def _is_single_polygon(value):
        return isinstance(value, list) and len(value) > 0 and all(_is_coord_pair(point) for point in value)

    def _is_polygon_collection(value):
        return isinstance(value, list) and len(value) > 0 and all(_is_single_polygon(poly) for poly in value)

    if polygon_data is None or polygon_data == []:
        camera.polygon = []
        camera.save()
        return Response({"success": True, "message": "Polygon cleared", "polygon": camera.polygon})

    if not isinstance(polygon_data, list):
        return Response({"success": False, "error": "Polygon must be a list"}, status=400)

    existing = camera.polygon or []
    if _is_single_polygon(existing):
        existing_polygons = [existing]
    elif _is_polygon_collection(existing):
        existing_polygons = list(existing)
    else:
        existing_polygons = []

    if _is_single_polygon(polygon_data):
        existing_polygons.append(polygon_data)
        camera.polygon = existing_polygons
    elif _is_polygon_collection(polygon_data):
        camera.polygon = polygon_data
    else:
        return Response(
            {"success": False, "error": "Polygon must be a list of [lng, lat] pairs or a list of polygons"},
            status=400,
        )

    camera.save()

    return Response({"success": True, "polygon": camera.polygon})

@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def camera_calibration_api(request, pk: int):
    """Get, save, or clear calibration data for a camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    if request.method == 'GET':
        return Response({
            "success": True,
            "is_calibrated": camera.is_calibrated,
            "calibration_points": camera.calibration_points,
            "reference_points": camera.reference_points,
            "reference_distance_meters": camera.reference_distance_meters,
            "meter_per_pixel": camera.meter_per_pixel,
        })
    
    if request.method == 'PUT':
        camera.calibration_points = request.data.get('calibration_points', [])
        camera.reference_points = request.data.get('reference_points', [])
        camera.reference_distance_meters = request.data.get('reference_distance_meters')
        camera.meter_per_pixel = request.data.get('meter_per_pixel')
        camera.is_calibrated = True
        camera.save()
        return Response({
            "success": True,
            "message": "Calibration saved",
            "is_calibrated": camera.is_calibrated,
        })
    
    # DELETE — clear calibration
    camera.calibration_points = []
    camera.reference_points = []
    camera.reference_distance_meters = None
    camera.meter_per_pixel = None
    camera.is_calibrated = False
    camera.save()
    return Response({"success": True, "message": "Calibration cleared"})

@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def camera_tags_api(request, pk: int):
    """Get or update tags for a camera"""
    user = request.user
    
    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)
    
    if request.method == 'GET':
        return Response({"success": True, "tags": camera.tags})
    
    tags = request.data.get('tags', [])
    if not isinstance(tags, list):
        return Response({"success": False, "error": "Tags must be a list"}, status=400)
    
    cleaned = list(dict.fromkeys(t.strip() for t in tags if isinstance(t, str) and t.strip()))
    camera.tags = cleaned
    camera.save()
    
    return Response({"success": True, "tags": camera.tags})


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
@permission_classes([IsAuthenticated])
def detect_road_elements(request, pk: int):
    """Run Mask R-CNN on the first frame of an uploaded video to auto-detect road elements (traffic signs)."""
    user = request.user

    try:
        camera = Camera.objects.get(pk=pk, user=user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)

    video_file = request.FILES.get('file')
    if not video_file:
        return Response({"success": False, "error": "No video file provided"}, status=400)

    if not DETECTRON2_AVAILABLE:
        return Response({"success": False, "error": "Detectron2 is not installed on this server"}, status=503)

    project_tmp = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tmp')
    os.makedirs(project_tmp, exist_ok=True)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4", dir=project_tmp) as tmp_file:
        for chunk in video_file.chunks():
            tmp_file.write(chunk)
        temp_path = tmp_file.name

    try:
        detected = detect_signs_on_first_frame_of_video(temp_path)
        return Response({"success": True, "road_elements": detected})
    except Exception as e:
        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def detect_road_features_latest(request, pk: int):
    """Run Mask R-CNN on the first-frame snapshot of the camera's most recently uploaded video."""
    try:
        camera = Camera.objects.get(pk=pk, user=request.user)
    except Camera.DoesNotExist:
        return Response({"success": False, "error": "Camera not found"}, status=404)

    if not DETECTRON2_AVAILABLE:
        return Response({"success": False, "error": "Detectron2 is not installed on this server"}, status=503)

    latest_video = camera.latest_video
    if not latest_video or not latest_video.thumbnail:
        return Response({"success": False, "error": "No latest video snapshot found for this camera"}, status=404)

    import base64
    thumbnail_b64 = latest_video.thumbnail
    
    if ',' in thumbnail_b64:
        thumbnail_b64 = thumbnail_b64.split(',', 1)[1]

    try:
        image_bytes = base64.b64decode(thumbnail_b64)
    except Exception:
        return Response({"success": False, "error": "Could not decode thumbnail"}, status=400)

    try:
        detected = detect_signs_on_image_bytes(image_bytes)
        return Response({
            "success": True,
            "road_features": detected,
            "video_id": latest_video.id,
            "video_name": latest_video.filename,
            "source": "latest_video_first_frame"
        })
    except Exception as e:
        traceback.print_exc()
        return Response({"success": False, "error": str(e)}, status=500)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
# gets a list of all videos in cameras that the user has
def video_list_api(request):
    user = request.user

    try:
        videos = Video.objects.filter(camera__user = user)
        ser = VideoSerializer(videos, many=True)
        return Response({ "success": True, "videos": ser.data })
    except:
        return Response({ "success": False, "error": "Unable to fetch videos" })


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def video_detail_api(request, pk: int):
    """Update or delete a specific video"""
    user = request.user
    
    try:
        video = Video.objects.get(pk=pk, camera__user=user)
    except Video.DoesNotExist:
        return Response({"success": False, "error": "Video not found"}, status=404)
    
    if request.method == 'GET':
        ser = VideoSerializer(video, many=False)
        return Response({ "success": True, "videos": ser.data })
    
    if request.method == 'PATCH':
        updated = False

        filename = request.data.get('filename')
        if filename:
            video.filename = filename
            updated = True

        for field in ('vehicles', 'speeding_count', 'swerving_count', 'abrupt_stopping_count'):
            val = request.data.get(field)
            if val is not None:
                try:
                    setattr(video, field, int(val))
                    updated = True
                except (ValueError, TypeError):
                    return Response({"success": False, "error": f"Invalid value for {field}"}, status=400)

        calibration_points = request.data.get('calibration_points')
        if calibration_points is not None:
            video.calibration_points = calibration_points
            updated = True

        reference_points = request.data.get('reference_points')
        if reference_points is not None:
            video.reference_points = reference_points
            updated = True

        reference_distance_meters = request.data.get('reference_distance_meters')
        if reference_distance_meters is not None:
            try:
                video.reference_distance_meters = float(reference_distance_meters) if reference_distance_meters else None
                updated = True
            except (ValueError, TypeError):
                return Response({"success": False, "error": "Invalid value for reference_distance_meters"}, status=400)

        if updated:
            video.save()
            ser = VideoSerializer(video)
            return Response({"success": True, "video": ser.data})
        return Response({"success": False, "error": "No valid fields provided"}, status=400)
    
    elif request.method == 'DELETE':
        video.delete()
        return Response({"success": True})

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def video_progress_api(request, pk: int):
    """Get processing status for a specific video"""
    user = request.user
    
    try:
        video = Video.objects.get(pk=pk, camera__user=user)
        return Response({
            "success": True,
            "processing_status": video.processing_status,
            "processing_stage": video.processing_stage,
            "yolo_progress": video.yolo_progress,
        })
    except Video.DoesNotExist:
        return Response({"success": False, "error": "Video not found"}, status=404)


@api_view(['POST'])
@permission_classes([AllowAny])
def model_results_callback(request):
    model_cfg = _get_model_service_settings()
    expected_token = model_cfg["callback_token"] or model_cfg["shared_token"]

    if expected_token:
        provided_token = _extract_bearer_token(request)
        if provided_token != expected_token:
            return Response({"success": False, "error": "Unauthorized callback"}, status=401)

    payload = request.data if isinstance(request.data, dict) else {}
    normalized = _normalize_callback_payload(payload)
    video_id = normalized["video_id"]
    if not video_id:
        return Response({"success": False, "error": "video_id is required"}, status=400)

    try:
        video = Video.objects.select_related('camera').get(pk=video_id)
    except Video.DoesNotExist:
        return Response({"success": False, "error": "Video not found"}, status=404)

    status_val = normalized["status"]
    now = timezone.now()

    video.processing_status = status_val
    video.yolo_progress = normalized["yolo_progress"]

    if normalized["duration_seconds"] is not None:
        video.duration_seconds = normalized["duration_seconds"]
    if normalized["fps"] is not None:
        video.fps = normalized["fps"]
    if normalized["resolution"]:
        video.resolution = str(normalized["resolution"])
    if normalized["thumbnail"]:
        video.thumbnail = str(normalized["thumbnail"])

    if status_val == 'completed':
        video.vehicles = normalized["vehicles"]
        video.speeding_count = normalized["speeding_count"]
        video.swerving_count = normalized["swerving_count"]
        video.abrupt_stopping_count = normalized["abrupt_stopping_count"]
        video.vehicle_breakdown = normalized["vehicle_breakdown"] if isinstance(normalized["vehicle_breakdown"], dict) else {}
        video.meter_per_pixel = normalized["meter_per_pixel"]
        video.jeepney_hotspot = normalized["jeepney_hotspot"]
        video.signs = normalized["signs"]
        video.sign_classes = normalized["sign_classes"]
        video.sign_breakdown = normalized["sign_breakdown"]
        video.processing_stage = 'complete'
        video.error_message = ''
        video.processing_completed_at = now
    elif status_val == 'failed':
        video.processing_stage = ''
        video.error_message = normalized["error"] or 'Remote processing failed'
        video.processing_completed_at = now
    else:
        video.processing_stage = 'yolo'
        if not video.processing_started_at:
            video.processing_started_at = now

    video.save()

    # Keep camera-level calibration in sync once remote inference computes meter_per_pixel.
    if status_val == 'completed' and video.meter_per_pixel is not None:
        cam = video.camera
        if cam is not None:
            cam.meter_per_pixel = video.meter_per_pixel
            if video.calibration_points:
                cam.calibration_points = video.calibration_points
            if video.reference_points:
                cam.reference_points = video.reference_points
            if video.reference_distance_meters is not None:
                cam.reference_distance_meters = video.reference_distance_meters
            cam.is_calibrated = True
            cam.latest_upload = now
            cam.save()

    return Response({"success": True, "video_id": video.id, "processing_status": video.processing_status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def behavior_timeline_api(request):
    user = request.user

    raw_ids = request.query_params.get('camera_ids', '')
    if not raw_ids:
        return Response({"success": False, "error": "camera_ids is required"}, status=400)

    try:
        camera_ids = [int(x) for x in raw_ids.split(',') if x.strip()]
    except ValueError:
        return Response({"success": False, "error": "Invalid camera_ids"}, status=400)

    cameras = Camera.objects.filter(pk__in=camera_ids, user=user)
    if not cameras.exists():
        return Response({"success": False, "error": "No matching cameras found"}, status=404)

    qs = Video.objects.filter(
        camera__in=cameras,
        processing_status='completed',
    )

    start = request.query_params.get('start')
    end = request.query_params.get('end')
    if start:
        qs = qs.filter(uploaded_at__date__gte=start)
    if end:
        qs = qs.filter(uploaded_at__date__lte=end)

    rows = (
        qs
        .annotate(date=TruncDate('uploaded_at'))
        .values('date')
        .annotate(
            speeding=Sum('speeding_count'),
            swerving=Sum('swerving_count'),
            abrupt_stopping=Sum('abrupt_stopping_count'),
            vehicles=Sum('vehicles'),
        )
        .order_by('date')
    )

    date_breakdowns: dict[str, dict[str, int]] = {}
    for vid in qs.annotate(date=TruncDate('uploaded_at')).values('date', 'vehicle_breakdown'):
        d_iso = vid['date'].isoformat()
        vb = vid['vehicle_breakdown']
        if not isinstance(vb, dict):
            continue
        entry = date_breakdowns.setdefault(d_iso, {})
        for k, v in vb.items():
            entry[k] = entry.get(k, 0) + (v if isinstance(v, int) else 0)

    data = [
        {
            'date': row['date'].isoformat(),
            'speeding': row['speeding'] or 0,
            'swerving': row['swerving'] or 0,
            'abrupt_stopping': row['abrupt_stopping'] or 0,
            'vehicles': row['vehicles'] or 0,
            'breakdown': date_breakdowns.get(row['date'].isoformat(), {}),
        }
        for row in rows
    ]

    return Response({"success": True, "timeline": data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def dashboard_summary(request):
    try:
        start = request.query_params.get("start")
        end = request.query_params.get("end")

        videos = Video.objects.filter(
            camera__user=request.user,
            processing_status="completed",
        )

        if start:
            videos = videos.filter(uploaded_at__date__gte=start)
        if end:
            videos = videos.filter(uploaded_at__date__lte=end)

        totals = {
            "vehicles": sum(v.vehicles for v in videos),
            "adb": sum(v.occurrences for v in videos),
            "speeding": sum(v.speeding_count for v in videos),
            "swerving": sum(v.swerving_count for v in videos),
            "abrupt_stopping": sum(v.abrupt_stopping_count for v in videos),
        }

        vehicle_breakdown = {}
        for video in videos:
            for label, value in (video.vehicle_breakdown or {}).items():
                vehicle_breakdown[label] = vehicle_breakdown.get(label, 0) + value

        saved_locations = SavedLocation.objects.filter(
            user=request.user,
            location_type="sub_area",
        )

        sub_areas = []
        for loc in saved_locations:
            loc_videos = videos.filter(camera__saved_location=loc)

            tags = set()
            camera_thumbnail = None

            for cam in loc.cameras.all():
                for tag in (cam.tags or []):
                    tags.add(tag)

            for video in loc_videos:
                if camera_thumbnail == None and video.thumbnail != None:
                    camera_thumbnail = video.thumbnail
                    break


            sub_areas.append({
                "id": loc.id,
                "name": loc.name,
                "lat": loc.lat,
                "lng": loc.lng,
                "geometry": loc.geometry,
                "bounds": loc.bounds,
                "camera_count": loc.camera_count,
                # "camera_id": sorted(camera_ids),
                "thumbnail": camera_thumbnail,
                "vehicles": sum(v.vehicles for v in loc_videos),
                "speeding": sum(v.speeding_count for v in loc_videos),
                "swerving": sum(v.swerving_count for v in loc_videos),
                "abrupt_stopping": sum(v.abrupt_stopping_count for v in loc_videos),
                "adb": sum(v.occurrences for v in loc_videos),
                "tags": sorted(tags),
            })

        return Response({
            "success": True,
            "totals": totals,
            "vehicle_breakdown": vehicle_breakdown,
            "sub_areas": sub_areas,
        })

    except Exception as e:
        traceback.print_exc()
        return Response(
            {"success": False, "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
    start = request.GET.get("start")
    end = request.GET.get("end")

    videos = Video.objects.filter(
        camera__user=request.user,
        processing_status="completed",
    )

    if start:
        videos = videos.filter(uploaded_at__date__gte=start)
    if end:
        videos = videos.filter(uploaded_at__date__lte=end)

    totals = {
        "vehicles": sum(v.vehicles for v in videos),
        "adb": sum(v.occurrences for v in videos),
        "speeding": sum(v.speeding_count for v in videos),
        "swerving": sum(v.swerving_count for v in videos),
        "abrupt_stopping": sum(v.abrupt_stopping_count for v in videos),
    }

    vehicle_breakdown = {}
    for video in videos:
        for label, value in (video.vehicle_breakdown or {}).items():
            vehicle_breakdown[label] = vehicle_breakdown.get(label, 0) + value

    saved_locations = SavedLocation.objects.filter(
        user=request.user,
        location_type="sub_area",
    )

    sub_areas = []
    for loc in saved_locations:
        loc_videos = videos.filter(camera__saved_location=loc)

        tags = set()
        for cam in loc.cameras.all():
            for tag in (cam.tags or []):
                tags.add(tag)

        sub_areas.append({
            "id": loc.id,
            "name": loc.name,
            "lat": loc.lat,
            "lng": loc.lng,
            "geometry": loc.geometry,
            "bounds": loc.bounds,
            "camera_count": loc.camera_count,
            "vehicles": sum(v.vehicles for v in loc_videos),
            "speeding": sum(v.speeding_count for v in loc_videos),
            "swerving": sum(v.swerving_count for v in loc_videos),
            "abrupt_stopping": sum(v.abrupt_stopping_count for v in loc_videos),
            "adb": sum(v.occurrences for v in loc_videos),
            "tags": sorted(tags),
        })

    return JsonResponse({
        "success": True,
        "totals": totals,
        "vehicle_breakdown": vehicle_breakdown,
        "sub_areas": sub_areas,
    })
    start = request.GET.get("start")
    end = request.GET.get("end")

    videos = Video.objects.filter(
        camera__user=request.user,
        processing_status="completed",
    )

    if start:
        videos = videos.filter(uploaded_at__date__gte=start)
    if end:
        videos = videos.filter(uploaded_at__date__lte=end)

    totals = {
        "vehicles": sum(v.vehicles for v in videos),
        "adb": sum(v.occurrences for v in videos),
        "speeding": sum(v.speeding_count for v in videos),
        "swerving": sum(v.swerving_count for v in videos),
        "abrupt_stopping": sum(v.abrupt_stopping_count for v in videos),
    }

    vehicle_breakdown = {}
    for video in videos:
        for label, value in (video.vehicle_breakdown or {}).items():
            vehicle_breakdown[label] = vehicle_breakdown.get(label, 0) + value

    saved_locations = SavedLocation.objects.filter(
        user=request.user,
        location_type="sub_area",
    )

    sub_areas = []
    for loc in saved_locations:
        loc_videos = videos.filter(camera__saved_location=loc)

        tags = set()
        for cam in loc.cameras.all():
            for tag in (cam.tags or []):
                tags.add(tag)

        sub_areas.append({
            "id": loc.id,
            "name": loc.name,
            "lat": loc.lat,
            "lng": loc.lng,
            "geometry": loc.geometry,
            "bounds": loc.bounds,
            "camera_count": loc.camera_count,
            "vehicles": sum(v.vehicles for v in loc_videos),
            "speeding": sum(v.speeding_count for v in loc_videos),
            "swerving": sum(v.swerving_count for v in loc_videos),
            "abrupt_stopping": sum(v.abrupt_stopping_count for v in loc_videos),
            "adb": sum(v.occurrences for v in loc_videos),
            "tags": sorted(tags),
        })

    return JsonResponse({
        "success": True,
        "totals": totals,
        "vehicle_breakdown": vehicle_breakdown,
        "sub_areas": sub_areas,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_landing_objects(request):
    try:
        locations = list(SavedLocation.objects.filter(user=request.user))
        cameras = list(Camera.objects.filter(user=request.user))
        videos = list(Video.objects.filter(camera__user=request.user))

        # Build relationship indexes once so the frontend can stay UI-focused.
        subarea_ids_by_aoi = {}
        for loc in locations:
            if loc.location_type == "sub_area" and loc.parent_id is not None:
                subarea_ids_by_aoi.setdefault(loc.parent_id, []).append(loc.id)

        camera_ids_by_subarea = {}
        camera_by_id = {}
        for camera in cameras:
            camera_by_id[camera.id] = camera
            if camera.saved_location_id is not None:
                camera_ids_by_subarea.setdefault(camera.saved_location_id, []).append(camera.id)

        videos_by_camera = {}
        for video in videos:
            videos_by_camera.setdefault(video.camera_id, []).append(video)

        stats_by_subarea = {}
        for subarea_id in camera_ids_by_subarea:
            stats_by_subarea[subarea_id] = {
                "vehicles": 0,
                "occurrences": 0,
                "speeding": 0,
                "swerving": 0,
                "abrupt_stopping": 0,
                "vehicle_breakdown": {},
            }

        for video in videos:
            camera = camera_by_id.get(video.camera_id)
            if camera is None or camera.saved_location_id is None:
                continue

            subarea_stats = stats_by_subarea.setdefault(camera.saved_location_id, {
                "vehicles": 0,
                "occurrences": 0,
                "speeding": 0,
                "swerving": 0,
                "abrupt_stopping": 0,
                "vehicle_breakdown": {},
            })

            subarea_stats["vehicles"] += (video.vehicles or 0)
            subarea_stats["occurrences"] += (video.occurrences or 0)
            subarea_stats["speeding"] += (video.speeding_count or 0)
            subarea_stats["swerving"] += (video.swerving_count or 0)
            subarea_stats["abrupt_stopping"] += (video.abrupt_stopping_count or 0)

            if isinstance(video.vehicle_breakdown, dict):
                for label, value in video.vehicle_breakdown.items():
                    subarea_stats["vehicle_breakdown"][label] = subarea_stats["vehicle_breakdown"].get(label, 0) + (value or 0)

        def behavior_summary_from_counts(speeding, swerving, abrupt_stopping):
            behaviors = []
            if speeding > 0:
                behaviors.append("Speeding")
            if swerving > 0:
                behaviors.append("Swerving")
            if abrupt_stopping > 0:
                behaviors.append("Abrupt Stopping")
            return behaviors if behaviors else ["No Data"]

        res_areas = []
        res_subareas = []
        for loc in locations:
            if loc.location_type == "aoi":
                child_subarea_ids = subarea_ids_by_aoi.get(loc.id, [])

                area_vehicles = 0
                area_occurrences = 0
                area_speeding = 0
                area_swerving = 0
                area_abrupt_stopping = 0
                area_breakdown = {}
                area_camera_count = 0

                for subarea_id in child_subarea_ids:
                    sub_stats = stats_by_subarea.get(subarea_id, {
                        "vehicles": 0,
                        "occurrences": 0,
                        "speeding": 0,
                        "swerving": 0,
                        "abrupt_stopping": 0,
                        "vehicle_breakdown": {},
                    })

                    area_vehicles += sub_stats["vehicles"]
                    area_occurrences += sub_stats["occurrences"]
                    area_speeding += sub_stats["speeding"]
                    area_swerving += sub_stats["swerving"]
                    area_abrupt_stopping += sub_stats["abrupt_stopping"]
                    area_camera_count += len(camera_ids_by_subarea.get(subarea_id, []))

                    for label, value in sub_stats["vehicle_breakdown"].items():
                        area_breakdown[label] = area_breakdown.get(label, 0) + value

                res_areas.append({
                    "id": loc.id,
                    "name": loc.name,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "zoom": loc.zoom,
                    "bearing": loc.bearing,
                    "pitch": loc.pitch,
                    "geometry": loc.geometry,
                    "bounds": loc.bounds,
                    "location_type": loc.location_type,
                    "sub_area_type": loc.sub_area_type,
                    "parent_id": loc.parent_id,
                    "subarea_count": len(child_subarea_ids),
                    "subarea_ids": child_subarea_ids,
                    "camera_count": area_camera_count,
                    "vehicles": area_vehicles,
                    "occurrences": area_occurrences,
                    "adb": area_occurrences,
                    "speeding": area_speeding,
                    "swerving": area_swerving,
                    "abrupt_stopping": area_abrupt_stopping,
                    "behaviors": behavior_summary_from_counts(area_speeding, area_swerving, area_abrupt_stopping),
                    "vehicle_breakdown": area_breakdown,
                })

            elif loc.location_type == "sub_area":
                subarea_stats = stats_by_subarea.get(loc.id, {
                    "vehicles": 0,
                    "occurrences": 0,
                    "speeding": 0,
                    "swerving": 0,
                    "abrupt_stopping": 0,
                    "vehicle_breakdown": {},
                })
                child_camera_ids = camera_ids_by_subarea.get(loc.id, [])

                res_subareas.append({
                    "id": loc.id,
                    "name": loc.name,
                    "lat": loc.lat,
                    "lng": loc.lng,
                    "zoom": loc.zoom,
                    "bearing": loc.bearing,
                    "pitch": loc.pitch,
                    "geometry": loc.geometry,
                    "bounds": loc.bounds,
                    "location_type": loc.location_type,
                    "sub_area_type": loc.sub_area_type,
                    "parent_id": loc.parent_id,
                    "camera_count": len(child_camera_ids),
                    "camera_ids": child_camera_ids,
                    "vehicles": subarea_stats["vehicles"],
                    "occurrences": subarea_stats["occurrences"],
                    "adb": subarea_stats["occurrences"],
                    "speeding": subarea_stats["speeding"],
                    "swerving": subarea_stats["swerving"],
                    "abrupt_stopping": subarea_stats["abrupt_stopping"],
                    "behaviors": behavior_summary_from_counts(subarea_stats["speeding"], subarea_stats["swerving"], subarea_stats["abrupt_stopping"]),
                    "vehicle_breakdown": subarea_stats["vehicle_breakdown"],
                })

        res_cameras = []
        for camera in cameras:
            camera_videos = videos_by_camera.get(camera.id, [])
            vehicles = 0
            occurrences = 0
            speeding = 0
            swerving = 0
            abrupt_stopping = 0
            vehicle_breakdown = {}

            for video in camera_videos:
                vehicles += (video.vehicles or 0)
                occurrences += (video.occurrences or 0)
                speeding += (video.speeding_count or 0)
                swerving += (video.swerving_count or 0)
                abrupt_stopping += (video.abrupt_stopping_count or 0)
                if isinstance(video.vehicle_breakdown, dict):
                    for label, value in video.vehicle_breakdown.items():
                        vehicle_breakdown[label] = vehicle_breakdown.get(label, 0) + (value or 0)

            latest_upload = camera.latest_upload
            if latest_upload is None and camera_videos:
                latest_upload = max(v.uploaded_at for v in camera_videos)

            res_cameras.append({
                "id": camera.id,
                "name": camera.name,
                "lat": camera.lat,
                "lng": camera.lng,
                "location": camera.location,
                "polygon": camera.polygon,
                "saved_location": camera.saved_location_id,
                "is_calibrated": camera.is_calibrated,
                "calibration_points": camera.calibration_points,
                "reference_points": camera.reference_points,
                "reference_distance_meters": camera.reference_distance_meters,
                "meter_per_pixel": camera.meter_per_pixel,
                "tags": camera.tags or [],
                "video_count": len(camera_videos),
                "video_ids": [video.id for video in camera_videos],
                "latest_upload": latest_upload,
                "vehicles": vehicles,
                "occurrences": occurrences,
                "adb": occurrences,
                "speeding": speeding,
                "swerving": swerving,
                "abrupt_stopping": abrupt_stopping,
                "behaviors": behavior_summary_from_counts(speeding, swerving, abrupt_stopping),
                "vehicle_breakdown": vehicle_breakdown,
            })

        ser_videos = VideoSerializer(videos, many=True)

        return Response({
            "success": True,
            "aois": res_areas,
            "subareas": res_subareas,
            "cameras": res_cameras,
            "videos": ser_videos.data,
        })

    except Exception as e:
        print(e)
        return Response({"success": False, "error": str(e)})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def inspect_video_metadata(request):
    """
    Inspect video file and extract metadata (creation_time, duration).
    
    Accepts video_id (GET/POST) or file path and returns:
    {
        "start_time": "ISO_8601_STRING_OR_NULL",
        "duration_seconds": float,
        "source": "metadata" | "filename" | "failed"
    }
    """
    try:
        video_id = request.query_params.get('video_id') or request.data.get('video_id')
        file_path = request.query_params.get('file_path') or request.data.get('file_path')
        
        # If video_id provided, get file path from database
        if video_id:
            try:
                video = Video.objects.get(pk=video_id, camera__user=request.user)
                # If the file is not persisted, return the metadata captured during upload.
                if video.start_time or video.duration_seconds is not None:
                    return Response({
                        "start_time": video.start_time.isoformat() if video.start_time else None,
                        "duration_seconds": video.duration_seconds,
                        "source": video.start_time_source or "failed",
                    })

                if hasattr(video, 'file') and video.file:
                    file_path = video.file.path
            except Video.DoesNotExist:
                return Response(
                    {"error": "Video not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        if not file_path:
            return Response(
                {"error": "Either video_id or file_path is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Perform inspection
        inspection_result = inspect_video(file_path)
        
        # Return raw JSON response (no wrapping)
        return Response(inspection_result)
        
    except Exception as e:
        return Response({
            "start_time": None,
            "duration_seconds": None,
            "source": "failed"
        })
