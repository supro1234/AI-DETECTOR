import sys
import os
import json

# Add engine to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from forensic_metrics import calculate_npr, calculate_ufd, calculate_crossvit_proxy

def test_metrics(image_path):
    print(f"Testing metrics for: {image_path}")
    if not os.path.exists(image_path):
        print("File not found")
        return

    npr = calculate_npr(image_path)
    ufd = calculate_ufd(image_path)
    cvit = calculate_crossvit_proxy(image_path)

    print(f"NPR:      {npr:.4f} ({round(npr*100)}%)")
    print(f"UFD:      {ufd:.4f} ({round(ufd*100)}%)")
    print(f"CrossViT: {cvit:.4f} ({round(cvit*100)}%)")

if __name__ == "__main__":
    uploads_dir = "d:/phython/Antigravity/AI_Image_Detector - Copy/backend/uploads"
    files = [f for f in os.listdir(uploads_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    if files:
        test_metrics(os.path.join(uploads_dir, files[0]))
    else:
        print("No images found in uploads directory to test.")
