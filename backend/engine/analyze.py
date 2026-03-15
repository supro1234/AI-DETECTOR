"""
engine/analyze.py
─────────────────
Dual-API Fusion Engine for AI Image Detection with Face Swap Detection.

Calls Gemini 2.0 Flash AND Groq Llama-4 Scout SIMULTANEOUSLY using
concurrent.futures, then merges results into a single authoritative verdict.

Features:
  - 16-point forensic analysis (including Face Swap as Point 16)
  - Gemini rate-limit retry with exponential backoff (3 retries: 1→2→4s)
  - Auto-fallback from Gemini → OpenRouter on rate-limit exhaustion
  - Face Swap Detection with dedicated verdict and confidence score

Supports all common image formats:
  JPEG, PNG, GIF, WEBP, BMP, TIFF, HEIC, AVIF, ICO, SVG (rasterized)

Usage (from Node.js via child_process):
  python analyze.py <gemini_key> <groq_key> <openrouter_key> <image_path> [mode]

  mode: "fusion" (default) | "gemini" | "groq" | "openrouter"
"""

import sys
import os
import json
import base64
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed, TimeoutError
import requests

# --------------------------------------------------------------------------- #
# Imports                                                                       #
# --------------------------------------------------------------------------- #
try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    from groq import Groq
except ImportError:
    Groq = None

from prompts import IMAGE_FORENSIC_PROMPT

try:
    from local_faceswap_detector import run_local_faceswap_detection
    LOCAL_DETECTOR_AVAILABLE = True
except ImportError:
    LOCAL_DETECTOR_AVAILABLE = False

try:
    from forensic_metrics import calculate_npr, calculate_ufd, calculate_crossvit_proxy
    FORENSIC_METRICS_AVAILABLE = True
except ImportError:
    FORENSIC_METRICS_AVAILABLE = False

try:
    from nsfw_detector import calculate_skin_score
    NSFW_DETECTOR_AVAILABLE = True
except ImportError:
    NSFW_DETECTOR_AVAILABLE = False

try:
    from background_detector import is_white_background
except ImportError:
    is_white_background = lambda x: False

# --------------------------------------------------------------------------- #
# Supported image types                                                         #
# --------------------------------------------------------------------------- #
IMAGE_MIME_MAP = {
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png':  'image/png',
    '.gif':  'image/gif',
    '.webp': 'image/webp',
    '.bmp':  'image/bmp',
    '.tiff': 'image/tiff',
    '.tif':  'image/tiff',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
    '.avif': 'image/avif',
    '.ico':  'image/x-icon',
    '.svg':  'image/svg+xml',
}


def get_mime_type(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    return IMAGE_MIME_MAP.get(ext, 'image/jpeg')


def encode_image_b64(path: str) -> str:
    with open(path, 'rb') as f:
        return base64.b64encode(f.read()).decode('utf-8')


def clean_json(text: str) -> dict:
    """Strip markdown fences and parse JSON from model output."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return json.loads(text.strip())


def is_rate_limit_error(err_str: str) -> bool:
    """Check if an error string indicates a rate limit / quota error."""
    lower = err_str.lower()
    return any(kw in lower for kw in [
        '429', 'resource_exhausted', 'rate limit', 'quota exceeded',
        'too many requests', 'rateLimitExceeded'
    ])


# --------------------------------------------------------------------------- #
# Gemini Analysis (with retry + fallback)                                       #
# --------------------------------------------------------------------------- #
def analyze_gemini(api_key: str, image_path: str, openrouter_key: str = '') -> dict:
    if genai is None:
        return {"error": "google-generativeai not installed"}
    if not api_key:
        return {"error": "No Gemini API key provided"}

    max_retries = 3
    delay = 1  # seconds, doubles each retry

    for attempt in range(max_retries):
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel("gemini-2.0-flash")

            with open(image_path, 'rb') as f:
                img_bytes = f.read()

            mime = get_mime_type(image_path)
            response = model.generate_content([
                IMAGE_FORENSIC_PROMPT,
                {"mime_type": mime, "data": img_bytes}
            ])

            result = clean_json(response.text)
            result["_source"] = "Gemini 2.0 Flash"
            
            # Use score directly from Rubric: 0-19=Real, 90-100=Fake
            conf = int(result.get("confidence_score", 50))
            result["confidence_score"] = conf
            
            # UI Bars consistent mapping
            naturalness = (100 - conf) / 100.0
            # UI Bars consistent mapping
            # Will be updated with real values in run_analysis
            result["model_breakdown"] = {
                "npr": 0,
                "ufd": 0,
                "crossvit": 0
            }

            if attempt > 0:
                result["_retry_note"] = f"Succeeded on retry {attempt + 1}"
            return result

        except Exception as e:
            err_str = str(e)
            if is_rate_limit_error(err_str):
                print(f"[GEMINI_RATE_LIMIT] Attempt {attempt + 1}/{max_retries}. Waiting {delay}s...", file=sys.stderr)
                if attempt < max_retries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                else:
                    # All retries exhausted — try OpenRouter fallback
                    print("[GEMINI_RATE_LIMIT] All retries exhausted. Attempting OpenRouter fallback...", file=sys.stderr)
                    if openrouter_key:
                        fallback = analyze_openrouter(openrouter_key, image_path)
                        fallback["_fusion_note"] = "Gemini rate-limited (429) — auto-fell back to OpenRouter"
                        fallback["_gemini_fallback"] = True
                        return fallback
                    return {"error": f"Gemini rate limit exceeded after {max_retries} retries. No OpenRouter fallback key available.", "_source": "Gemini 2.0 Flash"}
            else:
                return {"error": err_str, "_source": "Gemini 2.0 Flash"}

    return {"error": "Gemini: Unknown retry failure", "_source": "Gemini 2.0 Flash"}


# --------------------------------------------------------------------------- #
# OpenRouter Analysis                                                           #
# --------------------------------------------------------------------------- #
def analyze_openrouter(api_key: str, image_path: str) -> dict:
    if not api_key:
        return {"error": "No OpenRouter API key provided"}
    try:
        b64 = encode_image_b64(image_path)
        mime = get_mime_type(image_path)

        # Using Gemini 2.0 Flash via OpenRouter for consistency in multimodal
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            data=json.dumps({
                "model": "google/gemini-2.0-flash-001",
                "messages": [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": IMAGE_FORENSIC_PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{b64}"
                            }
                        }
                    ]
                }],
                "response_format": {"type": "json_object"}
            }),
            timeout=90
        )

        resp_json = response.json()
        if "error" in resp_json:
            return {"error": resp_json["error"].get("message", "Unknown OpenRouter Error")}

        content = resp_json["choices"][0]["message"]["content"]
        result = clean_json(content)
        result["_source"] = "OpenRouter (Gemini 2.0)"
        
        # Use rubric score directly (0-19% is Real, 90-100% is AI)
        conf = int(result.get("confidence_score", 50))
        result["confidence_score"] = conf
        
        # Consistent UI bars
        naturalness = (100 - conf) / 100.0
        # Consistent UI bars
        # Will be updated with real values in run_analysis
        result["model_breakdown"] = {
            "npr": 0,
            "ufd": 0,
            "crossvit": 0
        }

        return result
    except Exception as e:
        return {"error": str(e), "_source": "OpenRouter"}


# --------------------------------------------------------------------------- #
# Groq Analysis                                                                 #
# --------------------------------------------------------------------------- #
def analyze_groq(api_key: str, image_path: str) -> dict:
    if Groq is None:
        return {"error": "groq not installed"}
    if not api_key:
        return {"error": "No Groq API key provided"}
    try:
        client = Groq(api_key=api_key)
        b64 = encode_image_b64(image_path)
        mime = get_mime_type(image_path)

        response = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": IMAGE_FORENSIC_PROMPT},
                    {"type": "image_url", "image_url": {
                        "url": f"data:{mime};base64,{b64}"
                    }}
                ]
            }],
            temperature=0.1,
            response_format={"type": "json_object"},
            max_tokens=2048,
        )

        result = json.loads(response.choices[0].message.content)
        result["_source"] = "Groq Llama-4 Scout"
        
        # Use rubric score directly (0-19% is Real, 90-100% is AI)
        conf = int(result.get("confidence_score", 50))
        result["confidence_score"] = conf
        
        # Consistent UI bars
        naturalness = (100 - conf) / 100.0
        # Consistent UI bars
        # Will be updated with real values in run_analysis
        result["model_breakdown"] = {
            "npr": 0,
            "ufd": 0,
            "crossvit": 0
        }
        return result
    except Exception as e:
        return {"error": str(e), "_source": "Groq Llama-4 Scout"}


# --------------------------------------------------------------------------- #
# Hive Analysis                                                                 #
# --------------------------------------------------------------------------- #
def analyze_hive(access_key: str, secret_key: str, image_path: str) -> dict:
    """
    Call Hive AI (hive.ai) API for visual moderation and deepfake detection.
    V3 Pattern: uses Access Key ID and Secret Key.
    """
    access_key = access_key.strip() if access_key else ""
    secret_key = secret_key.strip() if secret_key else ""
    
    if not secret_key:
        return {"error": "No Hive Secret Key provided"}
        
    try:
        import base64
        url = "https://api.thehive.ai/api/v3/hive/visual-moderation"
        # Robust auth header preparation
        clean_secret = secret_key
        if clean_secret.lower().startswith("bearer "):
            clean_secret = clean_secret[7:].strip()
            
        headers = {
            "Authorization": f"Bearer {clean_secret}",
            "Content-Type": "application/json"
        }
        if access_key:
            headers["X-Hive-Key-Id"] = access_key
            
        with open(image_path, "rb") as f:
            image_data = f.read()
            base64_image = base64.b64encode(image_data).decode('utf-8')
            
        payload = {
            "input": [
                {
                    "media_base64": base64_image
                }
            ]
        }
        
        # MASKED DEBUGGING
        mask_secret = clean_secret[:4] + "*" * (len(clean_secret)-8) + clean_secret[-4:] if len(clean_secret) > 8 else "****"
        mask_access = access_key[:4] + "****" if access_key else "NONE"
        print(f"[HIVE_DEBUG] URL: {url}", file=sys.stderr)
        print(f"[HIVE_DEBUG] Auth: Bearer {mask_secret}", file=sys.stderr)
        print(f"[HIVE_DEBUG] KeyID: {mask_access}", file=sys.stderr)
        print(f"[HIVE_DEBUG] Payload size: {len(base64_image)} bytes", file=sys.stderr)

        response = None
        # Hive V3 can be unpredictable with header prefixes depending on account type.
        # We try: Bearer, token (case-sensitive), Direct (no prefix), and X-Hive-Key.
        auth_strategies = [
            {"Authorization": f"Bearer {clean_secret}"},
            {"Authorization": f"token {clean_secret}"},
            {"Authorization": clean_secret},
            {"X-Hive-Key": clean_secret}
        ]
        
        for i, auth_headers in enumerate(auth_strategies):
            # Refresh headers to avoid side effects
            headers = {
                "Content-Type": "application/json"
            }
            if access_key:
                headers["X-Hive-Key-Id"] = access_key
            
            headers.update(auth_headers)
            strategy_name = list(auth_headers.keys())[0]
            val_preview = list(auth_headers.values())[0][:8] + "..."
            
            print(f"[HIVE_DEBUG] Strategy {i+1}: {strategy_name} ({val_preview})", file=sys.stderr)
            
            response = requests.post(url, headers=headers, json=payload, timeout=90)
            if response.status_code != 401:
                print(f"[HIVE_DEBUG] Strategy {i+1} Success! (HTTP {response.status_code})", file=sys.stderr)
                break
            print(f"[HIVE_DEBUG] Strategy {i+1} Auth Failed (401).", file=sys.stderr)

        if response.status_code != 200:
            print(f"[HIVE_DEBUG] All Auth Strategies Exhausted. Final HTTP {response.status_code}: {response.text}", file=sys.stderr)
            return {"error": f"Hive API Error (HTTP {response.status_code})"}
            
        resp_json = response.json()
        if "error" in resp_json:
            return {"error": resp_json["error"].get("message", "Unknown Hive Error")}
            
        # V3 Pattern: output[0].classes[].class_name and value
        if "output" not in resp_json or not resp_json["output"]:
            print(f"[HIVE_DEBUG] Missing 'output' in response: {resp_json}", file=sys.stderr)
            return {"error": "Unexpected Hive API Response Structure"}

        classes_list = resp_json["output"][0].get("classes", [])
        raw_classes = {c.get("class_name", c.get("class", "")): c.get("value", 0) for c in classes_list}
        
        # Capture raw decimal scores for breakdown (Decimal 0.0 - 1.0)
        # Frontend expects percentages 0-100, so we convert later
        mb_raw = {
            "npr": raw_classes.get("npr", raw_classes.get("natural", 1.0)),
            "ufd": raw_classes.get("ufd", 1.0),
            "crossvit": raw_classes.get("crossvit", 1.0)
        }
        
        # Determine confidence and verdict
        # We prioritize the forensic npr/ufd/crossvit over a generic 'natural' class
        # because the user wants to see those 20-30% detections.
        natural_score = min(
            raw_classes.get("natural", 1.0),
            raw_classes.get("npr", 1.0),
            raw_classes.get("ufd", 1.0),
            raw_classes.get("crossvit", 1.0)
        )
        
        animated_score = raw_classes.get("animated", 0.0)
        hybrid_score = raw_classes.get("hybrid", 0.0)
        deepfake_signal = raw_classes.get("yes_realistic_nsfw", 0.0) 
        
        # Nudity/NSFW Signals
        nsfw_score = max(
            raw_classes.get("general_nsfw", 0),
            raw_classes.get("yes_sexual_activity", 0),
            raw_classes.get("yes_female_nudity", 0),
            raw_classes.get("yes_male_nudity", 0),
            raw_classes.get("yes_breast", 0),
            raw_classes.get("yes_genitals", 0)
        )
        suggestive_score = raw_classes.get("general_suggestive", 0)

        # CALIBRATED SCORING ENGINE (Optimized for Hive V3 Forensic Breakdown)
        # 🟢 VERIFIED REAL: All forensic markers > 0.97
        if natural_score > 0.97 and deepfake_signal < 0.1:
            score = round((1 - natural_score) * 100)
            verdict = "Verified Real"
        # 🔴 AI GENERATED: High synthetic detection
        elif deepfake_signal > 0.7 or animated_score > 0.7:
            score = round(max(deepfake_signal, animated_score) * 100)
            verdict = "AI Generated Proof"
        # 🟡 SUSPICIOUS: Hybrid or forensic anomalies
        elif hybrid_score > 0.4 or deepfake_signal > 0.3:
            score = round(max(hybrid_score, deepfake_signal) * 100)
            verdict = "Highly Suspicious"
        # 🟠 AI ENHANCED: Any forensic marker below 0.95 (i.e. >5% AI)
        # User wanted: "points like 20-30 then show AI ENHANCED"
        elif natural_score < 0.95:
            score = round((1 - natural_score) * 100)
            verdict = "AI Camera / Enhanced"
        else:
            score = 50
            verdict = "Uncertain"
            
        result = {
            "verdict": verdict,
            "confidence_score": score,
            "face_swap_detected": deepfake_signal > 0.8,
            "face_swap_confidence": round(deepfake_signal * 100),
            "nudity_detected": nsfw_score > 0.5,
            "nudity_confidence": round(nsfw_score * 100),
            "model_breakdown": {k: round(v * 100) for k, v in mb_raw.items()},
            "forensic_points": {
                "hive_natural": f"Score: {natural_score:.4f}",
                "hive_animated": f"Score: {animated_score:.4f}",
                "hive_hybrid": f"Score: {hybrid_score:.4f}",
                "hive_deepfake_signal": f"Score: {deepfake_signal:.4f}",
                "hive_nsfw_head": f"Score: {nsfw_score:.4f}",
                "hive_suggestive": f"Score: {suggestive_score:.4f}"
            },
            "nudity_breakdown": {
                "general_nsfw": raw_classes.get("general_nsfw", 0),
                "sexual_activity": raw_classes.get("yes_sexual_activity", 0),
                "female_nudity": raw_classes.get("yes_female_nudity", 0),
                "male_nudity": raw_classes.get("yes_male_nudity", 0),
                "breast_exposure": raw_classes.get("yes_breast", 0),
                "genitals_exposure": raw_classes.get("yes_genitals", 0)
            },
            "key_red_flags": [],
            "key_authentic_signals": [],
            "explanation": f"Hive AI V3 Analysis: {verdict} status identified via neural signals."
        }
        
        if nsfw_score > 0.7:
            result["key_red_flags"].append(f"Hive NSFW Trigger: {round(nsfw_score*100)}%")
        if animated_score > 0.5 or deepfake_signal > 0.5:
            result["key_red_flags"].append(f"Hive Synthetic Signature: {round(max(animated_score, deepfake_signal)*100)}%")
        if natural_score > 0.8:
            result["key_authentic_signals"].append(f"Hive Natural Texture: {round(natural_score*100)}%")
            
        result["_source"] = "Hive AI"
        return result
        
    except Exception as e:
        return {"error": str(e), "_source": "Hive AI"}


# --------------------------------------------------------------------------- #
# Face Swap Post-Processing                                                     #
# --------------------------------------------------------------------------- #
# IMPORTANT: Only include keywords that are EXCLUSIVELY markers of face swaps.
# Do NOT include terms that also describe AI camera enhancement / portrait mode
# (e.g. 'over-sharpening', 'skin smoothing', 'pore discontinuity' — these appear
# naturally in descriptions of beauty-filtered or portrait-mode photos).
FACE_SWAP_KEYWORDS = [
    'face swap', 'faceswap', 'face-swap', 'boundary seam',
    'face boundary', 'blending artifact', 'jawline inconsistency', 'neck seam',
    'hairline blending', 'face texture discontinuity', 'swapped face',
    # Modern face swap tool signatures — tool names are unambiguous
    'insightface', 'inswapper', 'simswap', 'deepfacelab', 'fsgan',
    'boundary halo', 'skin tone island', 'hd face on',
    # Physical seam markers — only appear with actual compositing
    'texture boundary', 'face region blurrier', 'identity geometry',
    'frequency tiling', 'paste signature', 'composite seam'
]

def post_process_face_swap(result: dict) -> dict:
    """
    User requested NO AI model face swap detection.
    Force the AI's internal face swap flags to False/0.
    """
    result["face_swap_detected"] = False
    result["face_swap_confidence"] = 0
    # The actual verdict/score correction is handled in refine_verdict
    return result


# --------------------------------------------------------------------------- #
# Result Refinement                                                             #
# --------------------------------------------------------------------------- #
def refine_verdict(score: int, original_verdict: str, face_swap_detected: bool = False, face_swap_confidence: int = 0, nudity_detected: bool = False, explanation: str = ""):
    """
    Standardize verdict and score.
    Returns: (verdict_string, corrected_score)
    """
    score = int(score)
    fs_conf = int(face_swap_confidence)
    explanation = (explanation or "").lower()

    # KEYWORD-BASED SKEPTICISM BOOST (Tiered Detection)
    # Tier 1: Heavy AI/Synthetic artifacts -> Force "AI Camera / Enhanced"
    HEAVY_ENHANCEMENT = [
        "waxy", "plastic", "artificial", "synthetic", "textureless", "over-smoothed", 
        "unnatural skin", "plastic skin", "rendered", "texture loss", "sheen"
    ]
    # Tier 2: Subtle enhancements -> Allow "Likely Real" but flag it
    SUBTLE_ENHANCEMENT = [
        "smoothed", "filtered", "processed", "denoised", "upscaled", "skin smoothing",
        "softened", "beauty filter", "portrait mode", "post-processed"
    ]
    
    clean_explanation = explanation.replace(".", " ").replace(",", " ").replace("!", " ")
    has_heavy = any(kw in clean_explanation for kw in HEAVY_ENHANCEMENT)
    has_subtle = any(kw in clean_explanation for kw in SUBTLE_ENHANCEMENT)
    
    # Logic: Heavy artifacts always trigger "Enhanced"
    if has_heavy and score < 45:
        score = max(score, 45)
        if original_verdict in ["Likely Real", "Verified Real", "Real", "Uncertain"]:
            original_verdict = "AI Camera / Enhanced"
            
    # Logic: Subtle enhancements boost to at least "Likely Real" (8-11 range)
    # but don't force them all the way to "Enhanced" unless the score is already high.
    elif has_subtle and score < 8:
        score = 10  # This lands in the "Likely Real" bucket
        if original_verdict in ["Verified Real", "Real"]:
            original_verdict = "Likely Real"

    # CRITICAL: SURREALISM & IMPOSSIBLE CONTENT BOOST
    # Any mention of impossible physics or surreal content forces "AI Generated Proof"
    SURREALISM_KEYWORDS = [
        "impossible", "surreal", "physically impossible", "floating", "flying",
        "impossible physics", "anatomical error", "hallucinated", "cat eating table",
        "flying horse", "multiple limbs", "distorted anatomy", "nonsense",
        "biting wood", "eating a table", "gnawing wood", "impossible scene",
        "unnatural behavior", "cat biting table"
    ]
    has_surreal = any(kw in clean_explanation for kw in SURREALISM_KEYWORDS)
    
    # Tier 3: REVERSE LOGIC PROTECTION
    # If a model uses "absence of artifacts" to support a "Real" verdict but
    # it's an impossible scene, they are being tricked.
    REVERSE_LOGIC_KEYWORDS = [
        "absence of gan", "absence of artifacts", "supports this assessment",
        "no significant indicators", "no clear signs of ai", "lack of ai indicators",
        "no artifacts", "without artifacts", "appears natural"
    ]
    has_reverse_logic = any(kw in clean_explanation for kw in REVERSE_LOGIC_KEYWORDS)
    
    # If it's an impossible scene OR they used defensive reasoning ANYWHERE in a non-raw image
    if has_surreal or (has_reverse_logic and score >= 1):
        return "AI Generated Proof", max(score, 95)

    # HIGHEST PRIORITY: Nudity-based Deepfake
    # Decoupled nudge: Only force "Deepfake" if nudity is present AND there is significant AI signal.
    # Otherwise, it might just be a real nude photo with subtle skin smoothing.
    if nudity_detected and score >= 70:
        return "Deepfake", max(score, 88)

    # SECOND PRIORITY: High-Confidence Face Swap
    if (face_swap_detected or original_verdict in ["Face Swap", "Deepfake"]):
        if fs_conf >= 85:
            return "Deepfake", max(score, 88)
        elif score >= 70:
            # High AI score + any swap mention -> Deepfake
            return "Deepfake", score
        else:
            # Lower score or subtle signal -> AI Camera / Enhanced
            return "AI Camera / Enhanced", max(score, 55)

    # Protected high-impact labels
    PROTECTED_VERDICTS = {"AI Generated Proof", "AI Generated", "Highly Suspicious", "Face Swap"}
    if original_verdict in PROTECTED_VERDICTS:
        return original_verdict, score

    # Forced range for specified labels
    if original_verdict in ["AI Camera / Enhanced", "AI Camera", "Enhanced"]:
        return "AI Camera / Enhanced", max(score, 45)

    # Standard score buckets (Skeptical Mode)
    if score >= 85:
        return "AI Generated Proof", score
    elif score >= 60: 
        return "Highly Suspicious", score
    elif score >= 12: # Lowered floor from 15 to 12 to capture ultra-subtle enhancements
        return "AI Camera / Enhanced", max(score, 45)
    elif score >= 8: # Tighter Likely Real window
        return "Likely Real", 10 # 90% realness
    else:
        return "Verified Real", 5 # 95% realness


# --------------------------------------------------------------------------- #
# Fusion Merger                                                                 #
# --------------------------------------------------------------------------- #
def merge_results(r_gemini: dict, r_groq: dict, r_hive: dict = None) -> dict:
    """Fuse analysis results into one authoritative verdict."""

    sources = []
    results = []
    
    if "error" not in r_gemini:
        sources.append("Gemini 2.0 Flash")
        results.append(r_gemini)
    if "error" not in r_groq:
        sources.append("Groq Llama-4 Scout")
        results.append(r_groq)
    if r_hive and "error" not in r_hive:
        sources.append("Hive AI")
        results.append(r_hive)

    # All failed
    if not results:
        return {
            "error": "All consulted APIs failed.",
            "verdict": "Error",
            "confidence_score": 0,
            "face_swap_detected": False,
            "face_swap_confidence": 0
        }

    # Initial Fused Score (Average)
    scores = [int(r.get("confidence_score", 50)) for r in results]
    fused_score = round(sum(scores) / len(scores))

    # SKEPTICAL FUSION (Neural Priority):
    # User instruction: "if hiveai said verified real... and points like 20s-30s... show AI ENHANCED"
    # If any Neural Broker (Gemini/Groq) detects AI features >= 20%
    # but Hive says 'Real' or 'Uncertain', we discard Hive's vote and force 'AI Enhanced'
    brokers_conf = [int(r.get("confidence_score", 0)) for r in results if r.get("_source") != "Hive AI" and "error" not in r]
    max_broker_conf = max(brokers_conf) if brokers_conf else 0
    
    if max_broker_conf >= 20 and r_hive and "error" not in r_hive:
        if VERDICT_PRIORITY.get(r_hive.get("verdict"), 0) < 30: # If Hive is Real/Uncertain
            # VETO HIVE: Remove Hive from results and sources
            results = [r for r in results if r.get("_source") != "Hive AI"]
            sources = [s for s in sources if "Hive" not in s]
            
            # Recalculate score (Max of skeptical brokers)
            scores = [int(r.get("confidence_score", 0)) for r in results]
            fused_score = max(scores) if scores else fused_score
            
            # Special case: If we veto Hive's 'Real' and brokers are in the 20-30 range, 
            # we force the verdict to Deepfake if swap signs existed, else Enhanced.
            # User wants "Deepfake with rose red" for these now.
            if 20 <= fused_score < 60:
                merged_fp_pre = {}
                tmp_flags = []
                tmp_auth = []
                is_swap_suspected = False
                nudity_in_fusion = False
                n_conf = 0
                
                for r in results:
                    merged_fp_pre.update(r.get("forensic_points", {}))
                    tmp_flags.extend(r.get("key_red_flags", []))
                    tmp_auth.extend(r.get("key_authentic_signals", []))
                    if r.get("face_swap_detected"):
                        is_swap_suspected = True
                    if r.get("nudity_detected"):
                        nudity_in_fusion = True
                        n_conf = max(n_conf, r.get("nudity_confidence", 0))

                # Use refine_verdict to decide if this should be Deepfake or Enhanced
                # This ensures we don't force 'Deepfake' on low-confidence suspected swaps
                v, s = refine_verdict(
                    fused_score,
                    "Face Swap" if is_swap_suspected else "AI Camera / Enhanced",
                    face_swap_detected=is_swap_suspected,
                    face_swap_confidence=max([int(r.get("face_swap_confidence", 0)) for r in results]),
                    nudity_detected=nudity_in_fusion
                )

                return {
                    "verdict": v,
                    "confidence_score": s,
                    "explanation": f"Forensic analysis prioritized over Hive: {v} signs identified by {', '.join(sources)}.",
                    "forensic_points": merged_fp_pre,
                    "key_red_flags": list(set(tmp_flags)),
                    "key_authentic_signals": list(set(tmp_auth)),
                    "face_swap_detected": is_swap_suspected,
                    "nudity_detected": nudity_in_fusion,
                    "nudity_confidence": n_conf,
                    "face_swap_confidence": max([int(r.get("face_swap_confidence", 0)) for r in results]),
                    "model_breakdown": {r.get("_source", "Model"): r.get("confidence_score", 0) for r in results},
                    "_sources_used": sources,
                    "_fusion_note": f"Veto Logic: Reclassified to {v} based on neural markers."
                }

    # HI-PRIORITY: Hive Authority Override
    # User requested Hive priority for Highly Suspicious, Deepfake, and Face Swap.
    # If Hive finds these, we skip standard fusion and trust Hive implicitly.
    if r_hive and "error" not in r_hive:
        h_verdict = r_hive.get("verdict", "Uncertain")
        if h_verdict in ["Highly Suspicious", "Deepfake", "Face Swap"]:
            return {
                "verdict": h_verdict,
                "confidence_score": r_hive.get("confidence_score", 50),
                "explanation": r_hive.get("explanation", "Prioritized forensic finding via Hive AI Authority."),
                "forensic_points": r_hive.get("forensic_points", {}),
                "key_red_flags": r_hive.get("key_red_flags", []),
                "key_authentic_signals": r_hive.get("key_authentic_signals", []),
                "face_swap_detected": r_hive.get("face_swap_detected", False),
                "face_swap_confidence": r_hive.get("face_swap_confidence", 0),
                "nudity_detected": r_hive.get("nudity_detected", False),
                "nudity_confidence": r_hive.get("nudity_confidence", 0),
                "model_breakdown": r_hive.get("model_breakdown", {}),
                "_sources_used": ["Hive AI Authority"],
                "_fusion_note": "Hive Authority Override triggered for critical detection."
            }

    # Standard Score/Verdict Merging (if Hive is not suspicious or failed)
    VERDICT_PRIORITY = {
        "Face Swap": 100,
        "Deepfake": 95,
        "AI Generated Proof": 90,
        "AI Generated": 90,
        "Highly Suspicious": 80,
        "AI Camera / Enhanced": 50,
        "Likely Real": 20,
        "Verified Real": 10,
        "Uncertain": 5
    }

    # Pick the verdict with the highest priority across all sources
    fused_verdict = "Uncertain"
    max_prio = -1
    
    for v in verdicts:
        prio = VERDICT_PRIORITY.get(v, 0)
        if prio > max_prio:
            max_prio = prio
            fused_verdict = v

    # STRICT AI FOCUS: The confidence_score must reflect the AI strength.
    # We use the MAX confidence of all models that detected an AI-based verdict.
    # If no AI verdict found (max_prio < 50), then it's a "Real" case, 
    # and we take the average (or highest) of the "Real" scores.
    if max_prio >= 50:
        suspicious_scores = [int(r.get("confidence_score", 0)) for r in results if VERDICT_PRIORITY.get(r.get("verdict"), 0) >= 50]
        fused_score = max(suspicious_scores) if suspicious_scores else fused_score
    else:
        # For real images, the fused_score (currently average) stays low.
        pass

    # Merge flags
    red_flags = []
    auth_signals = []
    nudity_detected = False
    nudity_confidence = 0
    nudity_breakdown = {}

    for r in results:
        red_flags.extend(r.get("key_red_flags", []))
        auth_signals.extend(r.get("key_authentic_signals", []))
        if r.get("nudity_detected"):
            nudity_detected = True
            nudity_confidence = max(nudity_confidence, r.get("nudity_confidence", 0))
            # Merge breakdowns (union)
            nudity_breakdown.update(r.get("nudity_breakdown", {}))
    
    red_flags = list(set(red_flags))
    auth_signals = list(set(auth_signals))

    # Merge nudity details
    # Collect all clothing types
    all_clothing = [str(r.get("nudity_details", {}).get("clothing_type", "")).strip() for r in results if r.get("nudity_details", {}).get("clothing_type")]
    
    # Priority for clothing type (most specific/suspicious first)
    CLOTHING_PRIO = ["None", "Underwear", "Bikini", "Sports Bra", "Normal Clothing"]
    best_clothing = "Normal Clothing"
    for cp in CLOTHING_PRIO:
        if any(cp.lower() in c.lower() for c in all_clothing):
            best_clothing = cp
            break

    nudity_details = {
        "is_explicit_nudity": any(r.get("nudity_details", {}).get("is_explicit_nudity", False) for r in results),
        "is_partial_nudity": any(r.get("nudity_details", {}).get("is_partial_nudity", False) for r in results),
        "male_genitalia": any(r.get("nudity_details", {}).get("male_genitalia", False) for r in results),
        "female_genitalia": any(r.get("nudity_details", {}).get("female_genitalia", False) for r in results),
        "female_breasts": any(r.get("nudity_details", {}).get("female_breasts", False) for r in results),
        "clothing_type": best_clothing,
        "anatomical_description": " | ".join(list(set([r.get("nudity_details", {}).get("anatomical_description", "") for r in results if r.get("nudity_details", {}).get("anatomical_description")])))
    }

    # Merge forensic_points
    merged_fp = {}
    for r in results:
        fp = r.get("forensic_points", {})
        for k, v in fp.items():
            if k not in merged_fp or len(str(v)) > len(str(merged_fp[k])):
                merged_fp[k] = v

    # Combined explanation
    explanations = [r.get("explanation", "") for r in results]
    fused_explanation = " | ".join([e for e in explanations if e])

    # Merge breakdowns
    merged_mb = {}
    for r in results:
        merged_mb.update(r.get("model_breakdown", {}))

    return {
        "verdict": fused_verdict,
        "confidence_score": fused_score,
        "face_swap_detected": any(r.get("face_swap_detected", False) for r in results),
        "face_swap_confidence": max([int(r.get("face_swap_confidence", 0)) for r in results] + [0]),
        "nudity_detected": nudity_detected,
        "nudity_confidence": nudity_confidence,
        "nudity_breakdown": nudity_breakdown,
        "model_breakdown": merged_mb,
        "forensic_points": merged_fp,
        "key_red_flags": red_flags,
        "key_authentic_signals": auth_signals,
        "nudity_details": nudity_details,
        "image_type_guess": results[0].get("image_type_guess", "Unknown"),
        "explanation": fused_explanation,
        "_sources_used": sources,
        "_fusion_note": f"Fused results from {len(sources)} neural sources."
    }


# --------------------------------------------------------------------------- #
# Main Entry                                                                    #
# --------------------------------------------------------------------------- #
def run_analysis(gemini_key: str, groq_key: str, openrouter_key: str, image_path: str, mode: str = "fusion", hive_key: str = "") -> dict:
    """Run analysis in the specified mode."""
    if not os.path.exists(image_path):
        return {"error": f"Image file not found: {image_path}"}

    t_start = time.time()

    # ── STEP 0: Local pixel-level forensic pre-scan ────────────────────────── #
    local_result = {"local_faceswap_detected": False, "local_faceswap_confidence": 0,
                    "local_forensic_summary": "Local detector not available", "checks": {}}
    if LOCAL_DETECTOR_AVAILABLE:
        try:
            local_result = run_local_faceswap_detection(image_path)
            print(f"[LOCAL_DETECTOR] detected={local_result['local_faceswap_detected']} "
                  f"conf={local_result['local_faceswap_confidence']}%", file=sys.stderr)
        except Exception as le:
            print(f"[LOCAL_DETECTOR] Error: {le}", file=sys.stderr)

    # ── STEP 0.5: White Background Detection ──────────────────────────────── #
    white_bg = is_white_background(image_path)
    print(f"[BACK_DETECTOR] white_background={white_bg}", file=sys.stderr)

    # ── STEP 1: AI API analysis ────────────────────────────────────────────── #
    if mode == "gemini":
        result = analyze_gemini(gemini_key, image_path, openrouter_key)
        result["_sources_used"] = [result.get("_source", "Gemini 2.0 Flash")]
    elif mode == "groq":
        result = analyze_groq(groq_key, image_path)
        result["_sources_used"] = ["Groq Llama-4 Scout"]
    elif mode == "openrouter":
        result = analyze_openrouter(openrouter_key, image_path)
        result["_sources_used"] = ["OpenRouter"]
    elif mode == "hive":
        h_access, h_secret = "", hive_key
        if "|" in hive_key:
            parts = hive_key.split("|", 1)
            h_access, h_secret = parts[0].strip(), parts[1].strip()
        result = analyze_hive(h_access, h_secret, image_path)
        result["_sources_used"] = ["Hive AI"]
    else:
        # Fusion: run whichever APIs have keys in parallel
        futures_map = {}
        with ThreadPoolExecutor(max_workers=4) as executor:
            if gemini_key:
                futures_map[executor.submit(analyze_gemini, gemini_key, image_path, openrouter_key)] = "gemini"
            if groq_key:
                futures_map[executor.submit(analyze_groq, groq_key, image_path)] = "groq"
            if hive_key:
                h_access, h_secret = "", hive_key
                if "|" in hive_key:
                    parts = hive_key.split("|", 1)
                    h_access, h_secret = parts[0].strip(), parts[1].strip()
                futures_map[executor.submit(analyze_hive, h_access, h_secret, image_path)] = "hive"

            r_gemini = {"error": "No Gemini key provided"}
            r_groq   = {"error": "No Groq key provided"}
            r_hive   = {"error": "No Hive key provided"}

            if futures_map:
                for future in as_completed(list(futures_map.keys()), timeout=120):
                    which = futures_map[future]
                    if which == "gemini":
                        r_gemini = future.result()
                    elif which == "groq":
                        r_groq = future.result()
                    elif which == "hive":
                        r_hive = future.result()

        result = merge_results(r_gemini, r_groq, r_hive)

        # Fallback to OpenRouter if all major LLMs failed
        if "error" in result and openrouter_key and not hive_key:
            print("[FUSION] Primary APIs failed — falling back to OpenRouter", file=sys.stderr)
            result = analyze_openrouter(openrouter_key, image_path)
            result["_fusion_note"] = "Primary APIs unavailable — OpenRouter fallback used"
            result["_sources_used"] = ["OpenRouter (Gemini 2.0)"]

    # ── STEP 2: AI post-process face swap detection ────────────────────────── #
    if "error" not in result:
        result = post_process_face_swap(result)

    # ── STEP 3: Fuse local detector results with AI results ────────────────── #
    # DECISION LOGIC (organised priority order):
    #
    #  Rule A — AI clearly says Face Swap → keep it (local adds evidence only)
    #  Rule B — AI says AI Generated / Highly Suspicious (no face swap flag)
    #            AND local fires → do NOT override (fully-generated image, not a swap)
    #  Rule C — AI is inconclusive / uncertain AND local is confident (>=50%) → Face Swap
    #  Rule D — AI suspected face swap (ai face_swap_confidence > 0) AND local confirms → Face Swap
    #  Rule E — Anything else below 50% local conf → ignore local, keep AI result

    if "error" not in result and local_result:
        local_detected  = local_result.get("local_faceswap_detected", False)
        local_conf      = int(local_result.get("local_faceswap_confidence", 0))
        local_summary   = local_result.get("local_forensic_summary", "")

        # Store local findings in result for full transparency
        result["_local_faceswap_detected"] = local_detected
        result["_local_faceswap_confidence"] = local_conf
        result["_local_forensic_summary"] = local_summary
        result["_local_checks"] = local_result.get("checks", {})

        ai_verdict = result.get("verdict", "")

        # Protected verdicts: local detector CANNOT override these to "Face Swap"
        # - "AI Generated Proof/AI Generated/Highly Suspicious" = fully synthetic image
        #   (shares traits with face swaps but is NOT a face swap)
        # - "AI Camera / Enhanced" = whole image processing, not a face swap
        FULLY_AI_VERDICTS = {
            "AI Generated Proof", "AI Generated", "Highly Suspicious",
            "AI Camera / Enhanced"
        }

        # ── Rule A: AI already decided Face Swap — just add local evidence ── #
        if ai_verdict == "Face Swap":
            if local_detected and local_summary:
                existing_flags = result.get("key_red_flags", [])
                result["key_red_flags"] = existing_flags + [
                    f"[LOCAL CONFIRM] {local_summary[:150]}"
                ]

        # ── Rule B: AI says fully-generated/camera — do NOT let local override ────── #
        elif ai_verdict in FULLY_AI_VERDICTS:
            result["_local_detector_note"] = (
                f"Local detector fired ({local_conf}%) but AI classified as '{ai_verdict}'. "
                f"Keeping AI verdict."
            )

        # ── Rule C: AI uncertain/weak + local is highly confident ≥ 60% ──────────── #
        elif local_detected and local_conf >= 60 and ai_verdict not in FULLY_AI_VERDICTS:
            result["face_swap_detected"] = True
            result["face_swap_confidence"] = local_conf
            result["verdict"] = "Face Swap"
            result["confidence_score"] = max(
                int(result.get("confidence_score", 0)),
                min(88, local_conf + 10)
            )
            existing_flags = result.get("key_red_flags", [])
            result["key_red_flags"] = existing_flags + [
                f"[LOCAL DETECTOR] {local_summary[:200]}"
            ]
            fp = result.get("forensic_points", {})
            fp["face_swap_analysis"] = (
                f"LOCAL OPENCV DETECTION ({local_conf}% confidence): {local_summary}\n"
                + str(fp.get("face_swap_analysis", ""))
            )
            result["forensic_points"] = fp

        # ── Rule D: below threshold — ignore local, keep AI verdict ─────────── #
        else:
            result["_local_detector_note"] = (
                f"Local confidence {local_conf}% below override thresholds (requires 60%) — AI verdict kept."
            )


    # ── STEP 4: Global verdict refinement ─────────────────────────────────── #
    if "confidence_score" in result:
        v, s = refine_verdict(
            result["confidence_score"],
            result.get("verdict", ""),
            face_swap_detected=bool(result.get("face_swap_detected", False)),
            face_swap_confidence=int(result.get("face_swap_confidence", 0)),
            nudity_detected=bool(result.get("nudity_detected", False)),
            explanation=result.get("explanation", "")
        )
        result["verdict"] = v
        result["confidence_score"] = s

    # ── STEP 4.5: Calculate Real Forensic Metrics ─────────────────────────── #
    if "error" not in result and FORENSIC_METRICS_AVAILABLE:
        try:
            npr_val = calculate_npr(image_path)
            ufd_val = calculate_ufd(image_path)
            cvit_val = calculate_crossvit_proxy(image_path)
            
            # Map back to 0-100 percentages (100 = suspicious)
            result["model_breakdown"] = {
                "npr": round(npr_val * 100),
                "ufd": round(ufd_val * 100),
                "crossvit": round(cvit_val * 100)
            }
            
            # Add to forensic points for transparency
            fp = result.get("forensic_points", {})
            fp["neural_pixel_ratio"] = f"Abnormality Score: {npr_val:.2f}"
            fp["unnatural_face_detail"] = f"Face/BG Entropy Diff: {ufd_val:.2f}"
            fp["cross_vit_signature"] = f"Patch Consistency Score: {cvit_val:.2f}"
            result["forensic_points"] = fp
            
        except Exception as fe:
            print(f"[FORENSIC_METRICS] Error: {fe}", file=sys.stderr)

    # ── STEP 4.6: Calculate Local NSFW/Skin Heuristic ─────────────────────── #
    if "error" not in result and NSFW_DETECTOR_AVAILABLE:
        try:
            skin_score, skin_metrics = calculate_skin_score(image_path)
            result["_local_skin_score"] = skin_score
            result["_local_skin_metrics"] = skin_metrics
            
            # ── STEP 4.6: Calculate Local NSFW/Skin Heuristic ─────────────────────── #
            # Improved logic: Respect the AI's clothing analysis.
            # Don't force nudity flag if AI explicitly identified swimwear/sportswear.
            nudity_details = result.get("nudity_details", {})
            explanation = str(result.get("explanation", "")).lower()
            clothing = str(nudity_details.get("clothing_type", "")).lower()
            
            SPORTSWEAR_KWS = ["sports bra", "bikini", "swimwear", "swimsuit", "athletic wear", "gym wear"]
            is_sportswear = any(kw in clothing for kw in SPORTSWEAR_KWS) or any(kw in explanation for kw in SPORTSWEAR_KWS)
            
            # Corroboration rules:
            llm_suspects = result.get("nudity_confidence", 0) > 40
            skin_heavy = skin_score > 0.75 # Increased from 0.6
            
            if llm_suspects and skin_heavy and not is_sportswear:
                result["nudity_confidence"] = max(result["nudity_confidence"], round(skin_score * 100))
                result["nudity_detected"] = True
            elif is_sportswear:
                # If AI identified it as sportswear, follow its lead and keep nudity false
                # unless explicit parts were also checked
                if not (nudity_details.get("female_breasts") or nudity_details.get("female_genitalia")):
                    result["nudity_detected"] = False
                    result["nudity_confidence"] = min(result.get("nudity_confidence", 0), 25)
                
        except Exception as ne:
            print(f"[NSFW_DETECTOR] Error: {ne}", file=sys.stderr)

    # ── STEP 5: White Background Override ─────────────────────────────────── #
    # If the user requested white backgrounds be classified as 'AI Camera / Enhanced'
    if white_bg:
        result["verdict"] = "AI Camera / Enhanced"
        result["confidence_score"] = 65
        result["face_swap_detected"] = False
        result["face_swap_confidence"] = 0
        result["explanation"] = (
            "White background detected. Content appears to be a studio-style "
            "capture or AI-enhanced subject on a clean background."
        )

    result["_analysis_time_ms"] = round((time.time() - t_start) * 1000)
    result["_image_path"] = os.path.basename(image_path)
    result["white_background_detected"] = white_bg
    return result


if __name__ == "__main__":
    import sys as _sys

    if len(_sys.argv) < 5:
        print(json.dumps({"error": "Usage: analyze.py <gemini_key> <groq_key> <openrouter_key> <image_path> [mode] [hive_key]"}))
        _sys.exit(1)

    gemini_key     = _sys.argv[1]
    groq_key       = _sys.argv[2]
    openrouter_key = _sys.argv[3]
    image_path     = _sys.argv[4]
    mode           = _sys.argv[5] if len(_sys.argv) > 5 else "fusion"
    hive_key       = _sys.argv[6] if len(_sys.argv) > 6 else ""

    output = run_analysis(gemini_key, groq_key, openrouter_key, image_path, mode, hive_key)
    print(json.dumps(output))
