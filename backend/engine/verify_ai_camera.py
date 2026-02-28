import json
import os
import sys

# --------------------------------------------------------------------------- #
# verify_ai_camera.py
# --------------------------------------------------------------------------- #
# This script validates the JSON schema used by the AI Image Detector forensic engine.
# 
# It mocks a response from the Gemini/Groq fusion engine that specifically 
# triggers the "AI Camera / Enhanced" verdict.
# --------------------------------------------------------------------------- #

mock_response = {
    "verdict": "AI Camera / Enhanced",
    "confidence_score": 42,
    "forensic_points": {
        "face_geometry": "Highly symmetrical facial features with slight surface smoothing.",
        "eye_iris": "Natural pupil shape and reflection present.",
        "hair": "Strand-level detail is consistent, but bokeh masking is aggressive.",
        "skin_texture": "Slight over-smoothing detected, consistent with AI portrait modes.",
        "lighting_shadows": "Primary lighting matches reflections, shadows are physically plausible.",
        "background_blend": "Aggressive synthetic blur around the subject's silhouette.",
        "hands_fingers": "Consistent digit count and anatomy.",
        "ear_nose_teeth": "Realistic structure.",
        "compression": "Typical mobile HEIC/JPEG compression.",
        "gan_diffusion": "No checkerboard or frequency domain GAN signatures found.",
        "watermark_metadata": "None detected.",
        "text_in_image": "N/A",
        "reflections": "Plausible environmental reflections.",
        "object_physics": "Consistent gravity and scale.",
        "overall_coherence": "High structural integrity with stylistic AI enhancement."
    },
    "key_red_flags": ["Synthetic Bokeh Artifacts", "Skin Surface Smoothing"],
    "key_authentic_signals": ["Natural Eye Detail", "Consistent Lighting Physics"],
    "image_type_guess": "Photograph (Enhanced)",
    "model_breakdown": {
        "npr": 68,
        "ufd": 54,
        "crossvit": 61
    },
    "explanation": "The image appears to be a real photograph that has been processed by a high-end AI camera or mobile portrait mode."
}

def verify_structure(result):
    print("--- DETECTOR_JSON_VERIFICATION ---")
    
    # 1. Check Required Keys
    required_keys = ["verdict", "confidence_score", "forensic_points", "explanation", "image_type_guess"]
    for key in required_keys:
        if key not in result:
            print(f"[-] FAILED: Missing essential key '{key}'")
            return False
    
    # 2. Validate Verdict Refinement Range
    score = result["confidence_score"]
    verdict = result["verdict"]
    
    valid_verdicts = ["AI Generated Proof", "Highly Suspicious", "AI Camera / Enhanced", "Likely Real", "Verified Real"]
    if verdict not in valid_verdicts:
        print(f"[-] FAILED: Invalid verdict label '{verdict}'")
        return False
        
    print(f"[+] Verdict: {verdict}")
    print(f"[+] Confidence: {score}%")
    print(f"[+] Forensic Hub: {len(result['forensic_points'])} data points validated.")
    print("[+] SUCCESS: JSON structure matches AI Image Detector schema.")
    return True

if __name__ == "__main__":
    if verify_structure(mock_response):
        # Only print the full JSON if valid
        print("\nValidated Mock Payload:")
        print(json.dumps(mock_response, indent=2))
    else:
        sys.exit(1)
