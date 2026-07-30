from rest_framework import serializers
from .models import SavedLocation, Camera, Video
from django.contrib.auth.models import User

class SavedLocationSerializer(serializers.ModelSerializer):
    camera_count = serializers.IntegerField(read_only=True)
    total_vehicles = serializers.IntegerField(read_only=True)
    total_occurrences = serializers.IntegerField(read_only=True)
    total_speeding = serializers.IntegerField(read_only=True)
    total_swerving = serializers.IntegerField(read_only=True)
    total_abrupt_stopping = serializers.IntegerField(read_only=True)
    behavior_summary = serializers.ListField(read_only=True)

    class Meta:
        model = SavedLocation
        fields = [
            "id",
            "user",
            "name",
            "lat",
            "lng",
            "zoom",
            "bearing",
            "pitch",
            "geometry",
            "bounds",
            "road_polygons",
            "location_type",
            "sub_area_type",
            "parent",
            "created_at",
            "camera_count",
            "total_vehicles",
            "total_occurrences",
            "total_speeding",
            "total_swerving",
            "total_abrupt_stopping",
            "behavior_summary",
        ]
        read_only_fields = ["user", "created_at"]
class SignupSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(required=True, allow_blank=False)
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username','email','password']

    def validate_email(self, value):
        email = value.strip()
        if not email:
            raise serializers.ValidationError("This field may not be blank.")
        return email

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data.get('email',''),
            password=validated_data['password']
        )
        return user

class VideoSerializer(serializers.ModelSerializer):
    occurrences = serializers.ReadOnlyField()
    behaviors = serializers.ReadOnlyField()
    processing_time_seconds = serializers.ReadOnlyField()
    
    class Meta:
        model = Video
        fields = [
            'id', 'camera', 'filename', 'uploaded_at', 'start_time', 'start_time_source',
            'duration_seconds', 'fps', 'resolution', 'file_size_mb', 'thumbnail',
            'calibration_points', 'reference_points', 'reference_distance_meters', 'meter_per_pixel',
            'vehicles', 'speeding_count', 'swerving_count', 'abrupt_stopping_count', 'vehicle_breakdown', 'jeepney_hotspot',
            'signs', 'sign_classes', 'sign_breakdown',
            'processing_started_at', 'processing_completed_at', 'processing_status', 'processing_stage',
            'yolo_progress', 'maskrcnn_progress', 'error_message',
            'occurrences', 'behaviors', 'processing_time_seconds'
        ]
        read_only_fields = ['id', 'uploaded_at']

class VideoSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for list views that excludes thumbnails and large JSON fields."""
    occurrences = serializers.ReadOnlyField()
    behaviors = serializers.ReadOnlyField()
    processing_time_seconds = serializers.ReadOnlyField()
    
    class Meta:
        model = Video
        fields = [
            'id', 'camera', 'filename', 'uploaded_at', 'start_time', 'start_time_source',
            'duration_seconds', 'fps', 'resolution', 'file_size_mb',
            'vehicles', 'speeding_count', 'swerving_count', 'abrupt_stopping_count', 'jeepney_hotspot',
            'signs', 
            'processing_started_at', 'processing_completed_at', 'processing_status', 'processing_stage',
            'yolo_progress', 'maskrcnn_progress', 'error_message',
            'occurrences', 'behaviors', 'processing_time_seconds'
        ]
        read_only_fields = ['id', 'uploaded_at']

class CameraSerializer(serializers.ModelSerializer):
    latest_upload = serializers.ReadOnlyField()
    latest_video = VideoSerializer(read_only=True)
    total_videos = serializers.ReadOnlyField()
    # For backward compatibility with frontend
    vehicles = serializers.SerializerMethodField()
    occurrences = serializers.SerializerMethodField()
    behaviors = serializers.SerializerMethodField()
    signs = serializers.SerializerMethodField()
    sign_classes = serializers.SerializerMethodField()
    latest_upload = serializers.DateTimeField(required=False, allow_null=True)
    polygon = serializers.JSONField(required=False, allow_null=True)
    saved_location = serializers.PrimaryKeyRelatedField(
        queryset=SavedLocation.objects.all(), required=False, allow_null=True
    )
    
    class Meta:
        model = Camera
        fields = [
            'id', 'name', 'lat', 'lng', 'location', 'polygon', 'created_at',
            'saved_location', 'latest_upload', 'latest_video', 'total_videos',
            'vehicles', 'occurrences', 'behaviors', 'signs', 'sign_classes',
            'calibration_points', 'reference_points', 'reference_distance_meters',
            'meter_per_pixel', 'is_calibrated', 'tags'
        ]
        read_only_fields = ['id', 'created_at']
    
    def get_vehicles(self, obj):
        """Get vehicles from latest video"""
        video = obj.latest_video
        return video.vehicles if video else 0
    
    def get_occurrences(self, obj):
        """Get occurrences from latest video"""
        video = obj.latest_video
        return video.occurrences if video else 0
    
    def get_behaviors(self, obj):
        """Get behaviors from latest video"""
        video = obj.latest_video
        return video.behaviors if video else ['No Data']
    
    def get_signs(self, obj):
        """Get signs from latest video"""
        video = obj.latest_video
        return video.signs if video else 0
    
    def get_sign_classes(self, obj):
        """Get sign classes from latest video"""
        video = obj.latest_video
        return video.sign_classes if video else []