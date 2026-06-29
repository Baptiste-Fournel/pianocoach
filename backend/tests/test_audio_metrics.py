from app.services import audio_analysis as aa


def test_coefficient_of_variation_even_is_zero():
    assert aa.coefficient_of_variation([1.0, 1.0, 1.0, 1.0]) == 0.0


def test_coefficient_of_variation_handles_edge_cases():
    assert aa.coefficient_of_variation([]) == 0.0
    assert aa.coefficient_of_variation([5.0]) == 0.0


def test_onset_regularity_perfectly_even_scores_high():
    onsets = [0.0, 0.5, 1.0, 1.5, 2.0, 2.5]  # metronomic
    res = aa.compute_onset_regularity(onsets)
    assert res["onset_count"] == 6
    assert res["interval_cv"] == 0.0
    assert res["regularity_score"] == 100.0


def test_onset_regularity_uneven_scores_lower():
    even = aa.compute_onset_regularity([0.0, 0.5, 1.0, 1.5, 2.0])
    uneven = aa.compute_onset_regularity([0.0, 0.2, 1.0, 1.1, 2.5])
    assert uneven["regularity_score"] < even["regularity_score"]


def test_onset_regularity_too_few_points():
    res = aa.compute_onset_regularity([0.0, 1.0])
    assert res["regularity_score"] is None


def test_tempo_curve_summary():
    res = aa.summarize_tempo_curve([120, 120, 120, 120])
    assert res["mean_bpm"] == 120.0
    assert res["bpm_cv"] == 0.0
    assert res["stability_score"] == 100.0
    assert aa.summarize_tempo_curve([])["mean_bpm"] is None


def test_dynamics_summary_range():
    # 0.1 and 1.0 RMS => 20 dB span.
    res = aa.summarize_dynamics([0.1, 1.0])
    assert abs(res["dynamic_range_db"] - 20.0) < 0.1
    assert aa.summarize_dynamics([])["mean_db"] is None


def test_downsample_caps_length_and_preserves_short():
    assert aa._downsample([1.0, 2.0, 3.0], max_points=10) == [1.0, 2.0, 3.0]
    big = list(range(1000))
    assert len(aa._downsample(big, max_points=50)) == 50
