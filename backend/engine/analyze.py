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
        return result
    except Exception as e:
        return {"error": str(e), "_source": "Groq Llama-4 Scout"}


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
    The local OpenCV detector (Step 3) is now the ONLY decider for Face Swap verdicts.
    """
    result["face_swap_detected"] = False
    result["face_swap_confidence"] = 0
    return result


# --------------------------------------------------------------------------- #
# Result Refinement                                                             #
# --------------------------------------------------------------------------- #
def refine_verdict(score: int, original_verdict: str, face_swap_detected: bool = False) -> str:
    """Standardize verdict based on confidence score and original model intent."""
    # HIGHEST PRIORITY: if face_swap_detected flag is set, always return Face Swap
    # regardless of score — this prevents score-based logic from overriding it
    if face_swap_detected:
        return "Face Swap"

    # Also preserve explicit Face Swap / Deepfake verdicts set by prior pipeline steps
    if original_verdict in ["Face Swap", "Deepfake"]:
        return original_verdict

    score = int(score)
    if score >= 85:
        return "AI Generated Proof"
    elif score >= 65:
        return "Highly Suspicious"
    elif score >= 40:
        return "AI Camera / Enhanced"
    elif score >= 18:
        return "Likely Real"
    else:
        return "Verified Real"


# --------------------------------------------------------------------------- #
# Fusion Merger                                                                 #
# --------------------------------------------------------------------------- #
def merge_results(r_gemini: dict, r_groq: dict) -> dict:
    """Fuse two analysis results into one authoritative verdict."""

    gemini_ok = "error" not in r_gemini
    groq_ok   = "error" not in r_groq

    # Both failed
    if not gemini_ok and not groq_ok:
        return {
            "error": f"Both APIs failed — Gemini: {r_gemini.get('error')}, Groq: {r_groq.get('error')}",
            "verdict": "Error",
            "confidence_score": 0,
            "face_swap_detected": False,
            "face_swap_confidence": 0
        }

    # Only one succeeded — return it directly
    if not gemini_ok:
        r_groq["_fusion_note"] = f"Gemini failed: {r_gemini.get('error')}. Result from Groq only."
        r_groq["_sources_used"] = ["Groq Llama-4 Scout"]
        return r_groq

    if not groq_ok:
        r_gemini["_fusion_note"] = f"Groq failed: {r_groq.get('error')}. Result from Gemini only."
        r_gemini["_sources_used"] = ["Gemini 2.0 Flash"]
        return r_gemini

    # Both succeeded — merge
    score_g = int(r_gemini.get("confidence_score", 70))
    score_q = int(r_groq.get("confidence_score", 70))
    fused_score = round((score_g + score_q) / 2)

    verdict_g = r_gemini.get("verdict", "Uncertain")
    verdict_q = r_groq.get("verdict", "Uncertain")

    # Face swap fusion — completely ignore AI model face swap outputs
    fused_face_swap = False
    fused_fs_confidence = 0

    if verdict_g == verdict_q:
        fused_verdict = verdict_g
    else:
        # Prioritize Face Swap verdict if either detected it
        if "Face Swap" in [verdict_g, verdict_q]:
            fused_verdict = "Face Swap"
        elif abs(score_g - score_q) <= 10:
            fused_verdict = "Uncertain"
        elif score_g > score_q:
            fused_verdict = verdict_g
        else:
            fused_verdict = verdict_q

    # Merge red flags and authentic signals (deduplicate)
    red_flags = list(set(
        r_gemini.get("key_red_flags", []) + r_groq.get("key_red_flags", [])
    ))
    auth_signals = list(set(
        r_gemini.get("key_authentic_signals", []) + r_groq.get("key_authentic_signals", [])
    ))

    # Merge forensic_points — prefer the one with longer text per key
    fp_g = r_gemini.get("forensic_points", {})
    fp_q = r_groq.get("forensic_points", {})
    all_keys = set(list(fp_g.keys()) + list(fp_q.keys()))
    merged_fp = {}
    for k in all_keys:
        val_g = fp_g.get(k, "")
        val_q = fp_q.get(k, "")
        merged_fp[k] = val_g if len(val_g) >= len(val_q) else val_q

    # Override if both systems agree on a specific high-confidence verdict
    if verdict_g == verdict_q and score_g > 80 and score_q > 80:
        fused_verdict = verdict_g

    # Image type guess — prefer Gemini (generally more descriptive)
    image_type = r_gemini.get("image_type_guess") or r_groq.get("image_type_guess", "Unknown")

    # Combined explanation
    exp_g = r_gemini.get("explanation", "")
    exp_q = r_groq.get("explanation", "")
    disagreement = ""
    if verdict_g != verdict_q:
        disagreement = f" [Note: Gemini classified as '{verdict_g}' ({score_g}%) while Groq classified as '{verdict_q}' ({score_q}%) — verdict resolved to '{fused_verdict}'.] "
    fused_explanation = f"{exp_g}{disagreement}"

    # Add face swap note if detected
    if fused_face_swap:
        fused_explanation += f" ⚠ Face Swap indicators detected (confidence: {fused_fs_confidence}%)."

    return {
        "verdict": fused_verdict,
        "confidence_score": fused_score,
        "face_swap_detected": fused_face_swap,
        "face_swap_confidence": fused_fs_confidence,
        "forensic_points": merged_fp,
        "key_red_flags": red_flags,
        "key_authentic_signals": auth_signals,
        "image_type_guess": image_type,
        "explanation": fused_explanation,
        "_sources_used": list(set(["Gemini 2.0 Flash", "Groq Llama-4 Scout"])),
        "_gemini_confidence": score_g,
        "_groq_confidence": score_q,
        "_gemini_verdict": verdict_g,
        "_groq_verdict": verdict_q,
        "_fusion_note": "Key APIs consulted — results fused."
    }


# --------------------------------------------------------------------------- #
# Main Entry                                                                    #
# --------------------------------------------------------------------------- #
def run_analysis(gemini_key: str, groq_key: str, openrouter_key: str, image_path: str, mode: str = "fusion") -> dict:
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
    else:
        # Fusion: run whichever APIs have keys in parallel
        futures_map = {}
        with ThreadPoolExecutor(max_workers=3) as executor:
            if gemini_key:
                futures_map[executor.submit(analyze_gemini, gemini_key, image_path, openrouter_key)] = "gemini"
            if groq_key:
                futures_map[executor.submit(analyze_groq, groq_key, image_path)] = "groq"

            r_gemini = {"error": "No Gemini key provided"}
            r_groq   = {"error": "No Groq key provided"}

            if futures_map:
                for future in as_completed(list(futures_map.keys()), timeout=120):
                    which = futures_map[future]
                    if which == "gemini":
                        r_gemini = future.result()
                    else:
                        r_groq = future.result()

        result = merge_results(r_gemini, r_groq)

        # If both Gemini and Groq failed but OpenRouter key is available, fall back
        if "error" in result and openrouter_key:
            print("[FUSION] Gemini+Groq both failed — falling back to OpenRouter", file=sys.stderr)
            result = analyze_openrouter(openrouter_key, image_path)
            result["_fusion_note"] = "Gemini+Groq unavailable — OpenRouter fallback used"
            result["_sources_used"] = ["OpenRouter (Gemini 2.0)"]
        elif "error" in result and not gemini_key and not groq_key and openrouter_key:
            result = analyze_openrouter(openrouter_key, image_path)
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

        # ── Rule C: AI uncertain/weak + local is highly confident ≥ 72% ──────────── #
        elif local_detected and local_conf >= 72 and ai_verdict not in FULLY_AI_VERDICTS:
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
                f"Local confidence {local_conf}% below override thresholds (requires 72%) — AI verdict kept."
            )


    # ── STEP 4: Global verdict refinement ─────────────────────────────────── #
    # Pass face_swap_detected so refine_verdict never accidentally overwrites a
    # Face Swap verdict that was correctly set by prior pipeline rules.
    if "confidence_score" in result:
        result["verdict"] = refine_verdict(
            result["confidence_score"],
            result.get("verdict", ""),
            face_swap_detected=bool(result.get("face_swap_detected", False))
        )

    result["_analysis_time_ms"] = round((time.time() - t_start) * 1000)
    result["_image_path"] = os.path.basename(image_path)
    return result


if __name__ == "__main__":
    import sys as _sys

    if len(_sys.argv) < 5:
        print(json.dumps({"error": "Usage: analyze.py <gemini_key> <groq_key> <openrouter_key> <image_path> [mode]"}))
        _sys.exit(1)

    gemini_key     = _sys.argv[1]
    groq_key       = _sys.argv[2]
    openrouter_key = _sys.argv[3]
    image_path     = _sys.argv[4]
    mode           = _sys.argv[5] if len(_sys.argv) > 5 else "fusion"

    output = run_analysis(gemini_key, groq_key, openrouter_key, image_path, mode)
    print(json.dumps(output))
