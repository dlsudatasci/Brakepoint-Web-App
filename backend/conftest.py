import sys
from unittest.mock import MagicMock

# ML dependency stubs 
def _stub(module_name: str, **attrs):
    if module_name not in sys.modules:
        m = MagicMock()
        for k, v in attrs.items():
            setattr(m, k, v)
        sys.modules[module_name] = m

_stub("yolo_processor",
      run_detection_on_video=MagicMock(return_value={"status": "success", "total_unique": 5,
                                                      "total_speeding": 1, "total_swerving": 1,
                                                      "total_abrupt_stopping": 0, "breakdown": {}}))
_stub("mask_rcnn_detectron2_processor",
      DETECTRON2_AVAILABLE=False,
      run_traffic_sign_detection_on_video=MagicMock(return_value={"status": "success", "unique_signs": 0}),
      detect_signs_on_first_frame_of_video=MagicMock(return_value={}),
      detect_signs_on_image_bytes=MagicMock(return_value={}))

_cv2 = MagicMock()
_cap_mock = MagicMock()
_cap_mock.isOpened.return_value = False   
_cv2.VideoCapture.return_value = _cap_mock
_stub("cv2", VideoCapture=_cv2.VideoCapture)
