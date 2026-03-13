import cv2
import numpy as np
import os

def calculate_skin_score(image_path):
    """
    Local NSFW heuristic: Skin-to-image ratio analysis.
    Checks HSV and YCrCb ranges for human skin tones.
    """
    try:
        img_bgr = cv2.imread(image_path)
        if img_bgr is None:
            return 0.0, {}
            
        h, w = img_bgr.shape[:2]
        total_pixels = h * w
        
        # 1. Convert to HSV and YCrCb
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        ycrcb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2YCrCb)
        
        # 2. Skin thresholds
        # HSV skin range
        lower_hsv = np.array([0, 48, 80], dtype="uint8")
        upper_hsv = np.array([20, 255, 255], dtype="uint8")
        mask_hsv = cv2.inRange(hsv, lower_hsv, upper_hsv)
        
        # YCrCb skin range
        lower_ycrcb = np.array([0, 133, 77], dtype="uint8")
        upper_ycrcb = np.array([255, 173, 127], dtype="uint8")
        mask_ycrcb = cv2.inRange(ycrcb, lower_ycrcb, upper_ycrcb)
        
        # Combined skin mask
        skin_mask = cv2.bitwise_and(mask_hsv, mask_ycrcb)
        
        # 3. Filter out small noise
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        skin_mask = cv2.erode(skin_mask, kernel, iterations=1)
        skin_mask = cv2.dilate(skin_mask, kernel, iterations=1)
        
        # 4. Calculate skin pixel count
        skin_pixels = cv2.countNonZero(skin_mask)
        skin_ratio = skin_pixels / total_pixels
        
        # 5. Determine secondary indicators (large clusters)
        # Large clusters of skin in the body region suggest nudity
        contours, _ = cv2.findContours(skin_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        large_cluster_found = False
        max_cluster_ratio = 0.0
        
        if contours:
            max_contour = max(contours, key=cv2.contourArea)
            max_area = cv2.contourArea(max_contour)
            max_cluster_ratio = max_area / total_pixels
            if max_cluster_ratio > 0.15: # Over 15% of image is one skin blob
                large_cluster_found = True
                
        metrics = {
            "skin_ratio": round(skin_ratio, 4),
            "max_cluster_ratio": round(max_cluster_ratio, 4),
            "suspicious_skin_volume": large_cluster_found or skin_ratio > 0.35
        }
        
        # Normalized score 0-1
        score = min(1.0, skin_ratio * 2.0 + (0.3 if large_cluster_found else 0.0))
        
        return score, metrics
        
    except Exception:
        return 0.0, {}
