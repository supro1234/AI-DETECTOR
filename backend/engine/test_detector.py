"""
Test script: Run local_faceswap_detector on an image.
Usage: python test_detector.py <image_path>
"""
import sys
import json
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from local_faceswap_detector import run_local_faceswap_detection

if len(sys.argv) < 2:
    print("Usage: python test_detector.py <image_path>")
    sys.exit(1)

image_path = sys.argv[1]
print(f"\n=== Testing: {image_path} ===\n")

result = run_local_faceswap_detection(image_path)

print(f"Detected:    {result['local_faceswap_detected']}")
print(f"Confidence:  {result['local_faceswap_confidence']}%")
print(f"Checks Fired:{result.get('local_checks_fired', 0)}")
print(f"\nSummary:\n{result['local_forensic_summary']}")
print("\nAll Check Scores:")
for k, v in result.get("checks", {}).items():
    score = v.get("score", 0) if isinstance(v, dict) else 0
    detail = v.get("detail", "") if isinstance(v, dict) else ""
    flag = "⚠️ FIRED" if score >= 30 else "  ✓ pass"
    print(f"  {flag} [{k}] score={score}: {detail[:100]}")
