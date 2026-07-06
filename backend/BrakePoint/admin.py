from django.contrib import admin
from .models import SavedLocation, Camera, Video

@admin.register(SavedLocation)
class SavedLocationAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'user', 'lat', 'lng', 'created_at']
    list_filter = ['user', 'created_at']
    search_fields = ['name', 'user__username']

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'lat', 'lng', 'created_at']
    list_filter = ['user', 'created_at']
    search_fields = ['user__username']

@admin.register(Video)
class VideoAdmin(admin.ModelAdmin):
    list_display = ['id', 'filename', 'camera', 'uploaded_at', 'vehicles', 'signs', 'processing_status']
    list_filter = ['processing_status', 'uploaded_at', 'camera', 'jeepney_hotspot']
    search_fields = ['filename', 'camera__name', 'camera__user__username']
    readonly_fields = ['uploaded_at']  
    fieldsets = (
        ('Basic Information', {
            'fields': ('camera', 'filename', 'uploaded_at')
        }),
        ('Video Metadata', {
            'fields': ('duration_seconds', 'fps', 'resolution', 'file_size_mb')
        }),
        ('Calibration Data', {
            'fields': ('calibration_points', 'reference_points', 'reference_distance_meters', 'meter_per_pixel'),
            'classes': ('collapse',)
        }),
        ('Detection Results', {
            'fields': ('vehicles', 'vehicle_breakdown', 'jeepney_hotspot', 'signs', 'sign_classes', 'sign_breakdown')
        }),
        ('Behavior Detection', {
            'fields': ('speeding_count', 'swerving_count', 'abrupt_stopping_count')
        }),
        ('Processing Status', {
            'fields': ('processing_status', 'processing_started_at', 'processing_completed_at', 'error_message')
        }),
    )
