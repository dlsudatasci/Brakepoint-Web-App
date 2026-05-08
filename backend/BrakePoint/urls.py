from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    path('brakepoint/api/csrf/', views.get_csrf_token, name='get_csrf_token'),
    path('brakepoint/api/check-auth/', views.check_auth, name='check_auth'),
    path('brakepoint/api/login/', views.api_login, name='api_login'),
    path('brakepoint/api/signup/', views.api_signup, name='api_signup'),
    path('brakepoint/api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # API endpoints
    path("brakepoint/api/saved-locations/", views.saved_locations_list_create, name="saved_locations_list_create"),
    path("brakepoint/api/saved-locations/<int:saved_location_id>/", views.saved_location_detail, name="saved_location_detail"),
    path("brakepoint/api/cameras/<int:camera_id>/assign-saved-location/", views.assign_camera_to_saved_location, name="assign_camera_to_saved_location"),
    path("brakepoint/api/dashboard-summary/", views.dashboard_summary, name="dashboard_summary"),
    
    # Camera endpoints
    path('brakepoint/api/cameras/', views.cameras_api, name='cameras_api'),
    path('brakepoint/api/cameras/<int:pk>/', views.camera_delete_api, name='camera_delete_api'),
    path('brakepoint/api/cameras/<int:pk>/polygon/', views.camera_polygon_api, name='camera_polygon_api'),
    path('brakepoint/api/cameras/<int:pk>/calibration/', views.camera_calibration_api, name='camera_calibration_api'),
    path('brakepoint/api/cameras/<int:pk>/tags/', views.camera_tags_api, name='camera_tags_api'),
    path('brakepoint/api/cameras/<int:pk>/detect-road-elements/', views.detect_road_elements, name='detect_road_elements'),
    path('brakepoint/api/cameras/<int:pk>/detect-road-features/', views.detect_road_features_latest, name='detect_road_features_latest'),
    path('brakepoint/api/cameras/<int:pk>/videos/', views.camera_videos_api, name='camera_videos_api'),
    path('brakepoint/api/upload_and_process/', views.upload_and_process_video, name='upload_and_process'),
    
    # Aggregation endpoints
    path('brakepoint/api/behavior-timeline/', views.behavior_timeline_api, name='behavior_timeline_api'),

    # Video endpoints
    path('brakepoint/api/videos/<int:pk>/', views.video_detail_api, name='video_detail_api'),
    path('brakepoint/api/videos/<int:pk>/progress/', views.video_progress_api, name='video_progress_api'),
]