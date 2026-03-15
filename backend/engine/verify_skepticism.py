import sys
import os

# Add the current directory to sys.path to import analyze
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from analyze import refine_verdict

def test_logic():
    print("--- Running Skepticism Logic Verification ---")
    
    # Test Case 1: Subtle Signal Boost (Keywords)
    # Score 20 is low, but keywords like 'smoothed' should boost it to 45 (Enhanced)
    v1, s1 = refine_verdict(20, "Likely Real", explanation="The image looks real but skin is slightly smoothed and denoised.")
    print(f"Test 1 (Keyword Boost): Expected 'AI Camera / Enhanced' (45+), Got '{v1}' ({s1})")
    assert v1 == "AI Camera / Enhanced" and s1 >= 45

    # Test Case 2: Lowered Enhanced Floor
    # Score 20 without keywords should now be 'AI Camera / Enhanced' (floor is 15)
    v2, s2 = refine_verdict(20, "Likely Real", explanation="Natural photo.")
    print(f"Test 2 (Floor 15): Expected 'AI Camera / Enhanced' (45+), Got '{v2}' ({s2})")
    assert v2 == "AI Camera / Enhanced" and s2 >= 45

    # Test Case 3: Very Low Signal (Likely Real)
    # Score 9 should be 'Likely Real' (new window is 8-11)
    v3, s3 = refine_verdict(9, "Likely Real", explanation="Natural photo.")
    print(f"Test 3 (New likely window): Expected 'Likely Real' (10), Got '{v3}' ({s3})")
    assert v3 == "Likely Real" and s3 == 10

    # Test Case 4: Verified Real
    # Score 5 should be 'Verified Real'
    v4, s4 = refine_verdict(5, "Verified Real", explanation="Raw sensor data.")
    print(f"Test 4 (Verified Real): Expected 'Verified Real' (5), Got '{v4}' ({s4})")
    assert v4 == "Verified Real" and s4 == 5

    # Test Case 6: Nude + Subtle AI Signal
    # Score 20 + Nudity -> should be 'AI Camera / Enhanced' (not Deepfake)
    v6, s6 = refine_verdict(20, "Likely Real", nudity_detected=True, explanation="Natural photo, but slightly smoothed.")
    print(f"Test 6 (Nude + Subtle): Expected 'AI Camera / Enhanced' (45+), Got '{v6}' ({s6})")
    assert v6 == "AI Camera / Enhanced" and s6 >= 45

    # Test Case 7: Nude + Strong AI Signal
    # Score 75 + Nudity -> should be 'Deepfake'
    v7, s7 = refine_verdict(75, "Highly Suspicious", nudity_detected=True, explanation="Strong artifacts.")
    print(f"Test 7 (Nude + Strong): Expected 'Deepfake' (88+), Got '{v7}' ({s7})")
    assert v7 == "Deepfake" and s7 >= 88

    # Test Case 8: Face Swap Red Alert Suppression
    # Score 45 (Enhanced) + face_swap_detected=True (but low FS confidence) -> AI Camera / Enhanced
    # This prevents the "Face Swap detected" red alert for subtle enhancements.
    v8, s8 = refine_verdict(45, "AI Camera / Enhanced", face_swap_detected=True, face_swap_confidence=40)
    print(f"Test 8 (FS Alert Suppression): Expected 'AI Camera / Enhanced', Got '{v8}'")
    assert v8 == "AI Camera / Enhanced"

    # Test Case 9: Skepticism V2 Keywords (Plastic Sheen)
    # Score 13 (very low) + "plastic sheen" -> should boost to 45 (Enhanced)
    v9, s9 = refine_verdict(13, "Likely Real", explanation="The face has a plastic sheen common in AI filters.")
    print(f"Test 9 (V2 Keywords): Expected 'AI Camera / Enhanced' (45+), Got '{v9}' ({s9})")
    assert v9 == "AI Camera / Enhanced" and s9 >= 45

    # Test Case 10: New 12% Floor
    # Score 12 without keywords should now be 'AI Camera / Enhanced'
    v10, s10 = refine_verdict(12, "Likely Real", explanation="Subtle texture diff.")
    print(f"Test 10 (Floor 12): Expected 'AI Camera / Enhanced' (45+), Got '{v10}' ({s10})")
    assert v10 == "AI Camera / Enhanced" and s10 >= 45

    print("\n--- ALL SKEPTICISM V2 TESTS PASSED ---")

if __name__ == "__main__":
    try:
        test_logic()
    except AssertionError as e:
        print(f"\n!!! TEST FAILED !!!")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\n!!! ERROR DURING TESTING: {e} !!!")
        sys.exit(1)
