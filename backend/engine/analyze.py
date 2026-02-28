"""
engine/analyze.py
─────────────────
Dual-API Fusion Engine for AI Image Detection.

Calls Gemini 2.0 Flash AND Groq Llama-4 Scout SIMULTANEOUSLY using
concurrent.futures, then merges results into a single authoritative verdict.

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


# --------------------------------------------------------------------------- #
# Gemini Analysis                                                               #
# --------------------------------------------------------------------------- #
def analyze_gemini(api_key: str, image_path: str) -> dict:
    if genai is None:
        return {"error": "google-generativeai not installed"}
    if not api_key:
        return {"error": "No Gemini API key provided"}
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
        return result
    except Exception as e:
        return {"error": str(e), "_source": "Gemini 2.0 Flash"}


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
# Result Refinement                                                             #
# --------------------------------------------------------------------------- #
def refine_verdict(score: int, original_verdict: str) -> str:
    """Standardize verdict based on confidence score and original model intent."""
    score = int(score)
    if score >= 90:
        return "AI Generated Proof"
    elif score >= 70:
        return "Highly Suspicious"
    elif score >= 40:
        return "AI Camera / Enhanced"
    elif score >= 20:
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
            "confidence_score": 0
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

    if verdict_g == verdict_q:
        fused_verdict = verdict_g
    else:
        # Pick higher-confidence verdict; tie → Uncertain
        if abs(score_g - score_q) <= 10:
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

    # Refine forensic_points — prefer the one with longer text per key

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
        disagreement = f" [Note: Gemini classified as '{verdict_g}' ({score_g}%) while Groq classified as '{verdict_q}' ({score_q}%) — verdict resolved to '{fused_verdict}'.]"
    fused_explanation = f"{exp_g}{disagreement}"

    return {
        "verdict": fused_verdict,
        "confidence_score": fused_score,
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

    if mode == "gemini":
        result = analyze_gemini(gemini_key, image_path)
        result["_sources_used"] = ["Gemini 2.0 Flash"]
    elif mode == "groq":
        result = analyze_groq(groq_key, image_path)
        result["_sources_used"] = ["Groq Llama-4 Scout"]
    elif mode == "openrouter":
        result = analyze_openrouter(openrouter_key, image_path)
        result["_sources_used"] = ["OpenRouter"]
    else:
        # Fusion: run Gemini and Groq in parallel (keeping existing core fusion)
        with ThreadPoolExecutor(max_workers=2) as executor:
            future_gemini = executor.submit(analyze_gemini, gemini_key, image_path)
            future_groq   = executor.submit(analyze_groq,   groq_key,   image_path)

            r_gemini = {"error": "Timeout"}
            r_groq   = {"error": "Timeout"}

            for future in as_completed([future_gemini, future_groq], timeout=90):
                if future == future_gemini:
                    r_gemini = future.result()
                else:
                    r_groq = future.result()

        result = merge_results(r_gemini, r_groq)

    # 4. Global Refinement (Applies even to single-provider modes)
    if "confidence_score" in result:
        result["verdict"] = refine_verdict(result["confidence_score"], result.get("verdict", ""))

    result["_analysis_time_ms"] = round((time.time() - t_start) * 1000)
    result["_image_path"] = os.path.basename(image_path)
    return result


if __name__ == "__main__":
    # Redirect non-JSON prints to stderr so Node.js only gets clean JSON
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
