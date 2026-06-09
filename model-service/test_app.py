import json

import service as A

client = A.app.test_client()

BASE = {
    "manufacturer": "ford", "model": "f-150", "year": 2015, "odometer": 60000,
    "cylinders": 8, "condition": "good", "fuel": "gas", "title_status": "clean",
    "transmission": "automatic", "drive": "4wd", "type": "pickup",
    "paint_color": "white", "state": "ca",
}


def _post(path, payload):
    r = client.post(path, data=json.dumps(payload), content_type="application/json")
    return r.status_code, r.get_json()

def test_predict_basic():
    code, d = _post("/predict", BASE)
    assert code == 200
    assert d["low"] <= d["price"] <= d["high"], "estimate must sit inside its band"
    assert d["price"] > 1000


def test_analyze_structure():
    code, d = _post("/analyze", BASE)
    assert code == 200
    for key in ("appraisal", "drivers", "recommendations", "forecast",
                "mileage_curve", "market"):
        assert key in d, f"missing section {key}"
    a = d["appraisal"]
    assert a["low"] <= a["estimate"] <= a["high"]


def test_drivers_are_real_sensitivities():
    _, d = _post("/analyze", BASE)
    drivers = d["drivers"]
    assert len(drivers) >= 5
    swings = [g["swing"] for g in drivers]
    assert swings == sorted(swings, reverse=True)
    for g in drivers:
        assert g["swing"] >= 0
        assert any(o["is_current"] for o in g["options"]), "current value must be flagged"
        cur = next(o for o in g["options"] if o["is_current"])
        assert abs(cur["delta"]) <= 1


def test_mileage_lowers_value():
    _, d = _post("/analyze", BASE)
    curve = d["mileage_curve"]
    assert curve[0]["value"] >= curve[-1]["value"], "high-mileage end should not exceed low-mileage end"


def test_depreciation_forecast_declines():
    _, d = _post("/analyze", BASE)
    pts = d["forecast"]["points"]
    assert len(pts) == 6
    assert pts[0]["value"] > pts[-1]["value"]
    assert 0 <= (d["forecast"]["retained_pct"] or 0) <= 100


def test_annual_miles_affects_forecast():
    _, low = _post("/analyze", {**BASE, "annual_miles": 4000})
    _, high = _post("/analyze", {**BASE, "annual_miles": 28000})
    assert high["forecast"]["points"][-1]["value"] <= low["forecast"]["points"][-1]["value"]


def test_recommendations_are_positive_and_directioned():
    rough = {**BASE, "condition": "fair", "title_status": "salvage"}
    _, d = _post("/analyze", rough)
    recs = d["recommendations"]
    assert recs, "rough car should surface improvement recommendations"
    assert all(r["delta"] > 0 for r in recs), "every recommendation must add value"
    kinds = {r["kind"] for r in recs}
    assert "title" in kinds


def test_market_context_is_grounded():
    _, d = _post("/analyze", BASE)
    m = d["market"]
    assert m["comparable_count"] > 0
    assert 0 <= m["percentile"] <= 100
    assert m["segment_median"] > 0
    assert m["reference_rows"] == 20000


def test_compare_awards():
    cheap = {**BASE, "manufacturer": "honda", "model": "civic", "year": 2012,
             "odometer": 140000, "cylinders": 4, "type": "sedan", "drive": "fwd"}
    pricey = {**BASE, "year": 2019, "odometer": 25000, "condition": "excellent"}
    code, d = _post("/compare", {"vehicles": [cheap, pricey]})
    assert code == 200
    results = d["results"]
    assert len(results) == 2
    cheapest = [i for i, r in enumerate(results) if r["award_cheapest"]]
    assert len(cheapest) == 1
    assert results[cheapest[0]]["estimate"] == min(r["estimate"] for r in results)
    assert any(r["award_holds_value"] for r in results)


def test_unknown_model_falls_back():
    _, d = _post("/analyze", {**BASE, "model": "zzqq-nonexistent-9000"})
    assert d["appraisal"]["known_model"] is False
    assert d["appraisal"]["estimate"] > 0


def test_bad_input_returns_400():
    code, d = _post("/predict", {"manufacturer": "ford"})
    assert code == 400
    assert "error" in d


def test_deal_verdict_logic():
    _, d = _post("/analyze", BASE)
    a = d["appraisal"]
    est, low, high = a["estimate"], a["low"], a["high"]

    def buyer_verdict(ask):
        r = ask / est
        if ask <= low: return "great"
        if r < 0.97: return "good"
        if r <= 1.03: return "fair"
        if ask <= high: return "high"
        return "over"

    assert buyer_verdict(low - 1) == "great"
    assert buyer_verdict(est) == "fair"
    assert buyer_verdict(high + 5000) == "over"

if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"  FAIL  {t.__name__}: {e}")
        except Exception as e:
            print(f"  ERROR {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(tests)} passed")
    raise SystemExit(0 if passed == len(tests) else 1)
