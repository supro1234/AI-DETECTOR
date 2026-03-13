import cv2
import numpy as np
import os

def is_white_background(image_path: str, threshold: int = 250, coverage_ratio: float = 0.95) -> bool:
    """
    Detect if an image has a 'completely' white background.
    - threshold: pixel value (0-255) above which is considered 'white'. 250 is near perfect white.
    - coverage_ratio: fraction of outer border pixels that must be white.
    """
    if not os.path.exists(image_path):
        return False
        
    try:
        img = cv2.imread(image_path)
        if img is None:
            return False
            
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        
        # We define 'background' as the outer frame of the image
        # Let's sample the top, bottom, left, and right 2% of the image
        margin_h = max(1, int(h * 0.02))
        margin_w = max(1, int(w * 0.02))
        
        top_edge = gray[0:margin_h, :]
        bottom_edge = gray[h-margin_h:h, :]
        left_edge = gray[:, 0:margin_w]
        right_edge = gray[:, w-margin_w:w]
        
        # Combine all edge pixels
        edge_pixels = np.concatenate([
            top_edge.flatten(),
            bottom_edge.flatten(),
            left_edge.flatten(),
            right_edge.flatten()
        ])
        
        # Calculate what percentage of edge pixels are above the 'white' threshold
        white_pixels = np.sum(edge_pixels >= threshold)
        actual_ratio = white_pixels / len(edge_pixels)
        
        # Also check the overall average brightness of the padding
        # A true white background should have very low variance (near 0) and high mean
        edge_mean = np.mean(edge_pixels)
        edge_std = np.std(edge_pixels)
        
        is_white = (actual_ratio >= coverage_ratio) and (edge_mean >= threshold) and (edge_std < 10)
        
        return bool(is_white)
        
    except Exception as e:
        print(f"Error in white background detection: {e}")
        return False

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = is_white_background(sys.argv[1])
        print(result)
