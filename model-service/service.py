import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from flask import Flask, jsonify, request

HERE = Path(__file__).parent
app = Flask(__name__)

ART = joblib.load(HERE / "model_artifacts.joblib")
MODEL = ART["model"]
TE_MAPS = ART["te_maps"]
GLOBAL_MEAN = ART["global_mean"]
FEATURE_COLUMNS = ART["feature_columns"]
CYL_MEDIAN = ART["cyl_median"]
OPTIONS = json.loads((HERE / "options.json").read_text())
INTEL = json.loads((HERE / "market_intel.json").read_text())

ONEHOT_COLS = ["condition", "fuel", "title_status", "transmission", "drive", "type", "paint_color"]
REF_YEAR = 2021

COND_ORDER = ["salvage", "fair", "good", "excellent", "like new", "new"]
TITLE_ORDER = ["parts only", "missing", "salvage", "rebuilt", "lien", "clean"]

DRIVER_FACTORS = [
    ("condition", "Condition", "Reported cosmetic/mechanical state"),
    ("title_status", "Title status", "Legal/insurance history of the title"),
    ("odometer", "Mileage", "Odometer reading"),
    ("cylinders", "Engine", "Cylinder count"),
    ("drive", "Drivetrain", "Front / rear / all-wheel drive"),
    ("fuel", "Fuel", "Engine fuel type"),
    ("transmission", "Transmission", "Automatic vs manual"),
    ("paint_color", "Paint color", "Exterior color"),
    ("type", "Body style", "Vehicle body type"),
]

def feature_dict(p):
    year = float(p["year"])
    row = {
        "vehicle_age": REF_YEAR - year,
        "odometer": float(p["odometer"]),
        "cylinders": float(p.get("cylinders") or CYL_MEDIAN),
    }
    model_norm = re.sub(r"[^a-z0-9 ]", "", str(p["model"]).lower().strip())
    model_grp = model_norm if model_norm in TE_MAPS["model_grp"] else "other"
    row["manufacturer_te"] = TE_MAPS["manufacturer"].get(p["manufacturer"], GLOBAL_MEAN)
    row["model_grp_te"] = TE_MAPS["model_grp"].get(model_grp, GLOBAL_MEAN)
    row["state_te"] = TE_MAPS["state"].get(p["state"], GLOBAL_MEAN)
    for col in ONEHOT_COLS:
        dummy = f"{col}_{p.get(col, 'unknown')}"
        if dummy in FEATURE_COLUMNS:
            row[dummy] = 1
    return row, model_grp


def _frame(param_dicts):
    rows, grps = [], []
    for p in param_dicts:
        r, g = feature_dict(p)
        rows.append(r)
        grps.append(g)
    X = pd.DataFrame(rows).reindex(columns=FEATURE_COLUMNS).fillna(0)
    return X, grps


def predict_prices(param_dicts):
    X, grps = _frame(param_dicts)
    prices = np.expm1(MODEL.predict(X))
    return prices, grps


def predict_with_interval(p):
    X, grps = _frame([p])
    point = float(np.expm1(MODEL.predict(X)[0]))
    tree_preds = np.expm1([t.predict(X.values)[0] for t in MODEL.estimators_])
    lo, hi = np.percentile(tree_preds, [10, 90])
    return point, float(lo), float(hi), grps[0]

def candidate_values(key, base):
    if key == "condition":
        opts = [c for c in COND_ORDER if c in OPTIONS["conditions"]]
    elif key == "title_status":
        opts = [t for t in TITLE_ORDER if t in OPTIONS["title_statuses"]]
    elif key == "cylinders":
        opts = [int(c) for c in OPTIONS["cylinders"]]
    elif key == "odometer":
        o = float(base["odometer"])
        cand = sorted({max(1000.0, o - 40000), max(1000.0, o - 20000), o,
                       min(300000.0, o + 20000), min(300000.0, o + 40000)})
        opts = [int(v) for v in cand]
    elif key == "drive":
        opts = [d for d in OPTIONS["drives"] if d != "unknown"]
    elif key == "fuel":
        opts = list(OPTIONS["fuels"])
    elif key == "transmission":
        opts = [t for t in OPTIONS["transmissions"] if t != "other"]
    elif key == "paint_color":
        opts = [c for c in OPTIONS["paint_colors"] if c != "unknown"]
    elif key == "type":
        opts = [t for t in OPTIONS["types"] if t != "unknown"]
    else:
        opts = []
    cur = base.get(key)
    if key in ("odometer", "cylinders"):
        cur = int(float(cur)) if cur not in (None, "") else None
    if cur is not None and cur not in opts:
        opts = sorted(set(opts) | {cur}, key=lambda v: (isinstance(v, str), v))
    return opts, cur


def value_drivers(base, base_price):
    scenarios, meta = [], []
    for key, label, desc in DRIVER_FACTORS:
        opts, cur = candidate_values(key, base)
        if len(opts) < 2:
            continue
        for v in opts:
            sp = dict(base)
            sp[key] = v
            scenarios.append(sp)
            meta.append((key, label, desc, v, cur))

    if not scenarios:
        return []
    prices, _ = predict_prices(scenarios)

    grouped = {}
    for (key, label, desc, v, cur), price in zip(meta, prices):
        g = grouped.setdefault(key, {"key": key, "label": label, "desc": desc,
                                     "current": cur, "options": []})
        g["options"].append({
            "value": v,
            "price": int(round(price)),
            "delta": int(round(price - base_price)),
            "is_current": (str(v) == str(cur)),
        })

    drivers = []
    for g in grouped.values():
        prices_here = [o["price"] for o in g["options"]]
        best = max(g["options"], key=lambda o: o["price"])
        worst = min(g["options"], key=lambda o: o["price"])
        g["swing"] = int(max(prices_here) - min(prices_here))
        g["best"] = best
        g["worst"] = worst
        g["upside"] = int(best["price"] - base_price)
        g["downside"] = int(worst["price"] - base_price)
        drivers.append(g)

    drivers.sort(key=lambda d: d["swing"], reverse=True)
    return drivers


def depreciation_forecast(base, base_price, annual_miles=12000, years=5):
    o0 = float(base["odometer"])
    scenarios, ages, odos = [], [], []
    for y in range(0, years + 1):
        sp = dict(base)
        sp["year"] = float(base["year"]) - y          # older model year => older car
        sp["odometer"] = min(300000.0, o0 + annual_miles * y)
        scenarios.append(sp)
        ages.append(int(REF_YEAR - float(base["year"]) + y))
        odos.append(int(sp["odometer"]))
    prices, _ = predict_prices(scenarios)
    prices = [int(round(p)) for p in prices]
    prices[0] = int(round(base_price))

    points = [{"year_offset": y, "age": ages[y], "odometer": odos[y], "value": prices[y]}
              for y in range(len(prices))]
    total_loss = prices[0] - prices[-1]
    return {
        "annual_miles": annual_miles,
        "years": years,
        "points": points,
        "total_loss": int(total_loss),
        "retained_pct": round(prices[-1] / prices[0] * 100, 1) if prices[0] else None,
        "avg_annual_loss": int(round(total_loss / years)) if years else 0,
        "value_in_3yr": prices[3] if len(prices) > 3 else prices[-1],
    }


def mileage_curve(base, steps=13):
    o0 = float(base["odometer"])
    lo = max(1000.0, o0 - 60000)
    hi = min(300000.0, max(o0 + 120000, lo + 120000))
    xs = np.linspace(lo, hi, steps)
    scenarios = []
    for x in xs:
        sp = dict(base)
        sp["odometer"] = float(x)
        scenarios.append(sp)
    prices, _ = predict_prices(scenarios)
    return [{"odometer": int(round(x)), "value": int(round(p))}
            for x, p in zip(xs, prices)]


def recommendations(base, base_price):
    recs = []

    cur_cond = base.get("condition")
    if cur_cond in COND_ORDER:
        i = COND_ORDER.index(cur_cond)
        targets = []
        if i + 1 < len(COND_ORDER) and COND_ORDER[i + 1] in OPTIONS["conditions"]:
            targets.append(COND_ORDER[i + 1])
        for top in ("excellent", "like new"):
            if top in OPTIONS["conditions"] and COND_ORDER.index(top) > i and top not in targets:
                targets.append(top)
        for t in targets[:1]:  # one realistic step
            sp = dict(base); sp["condition"] = t
            price = float(predict_prices([sp])[0][0])
            if price - base_price > 50:
                recs.append({
                    "kind": "condition",
                    "label": f"Recondition to “{t}”",
                    "detail": f"Detailing/repairs that lift the grade from {cur_cond} to {t}.",
                    "delta": int(round(price - base_price)),
                })

    cur_title = base.get("title_status")
    if cur_title and cur_title != "clean" and "clean" in OPTIONS["title_statuses"]:
        sp = dict(base); sp["title_status"] = "clean"
        price = float(predict_prices([sp])[0][0])
        if price - base_price > 50:
            recs.append({
                "kind": "title",
                "label": "A clean title",
                "detail": f"Vehicles with a clean title (vs {cur_title}) command more.",
                "delta": int(round(price - base_price)),
            })

    o0 = float(base["odometer"])
    if o0 - 10000 >= 1000:
        sp = dict(base); sp["odometer"] = o0 - 10000
        price = float(predict_prices([sp])[0][0])
        per10k = price - base_price
        if per10k > 50:
            recs.append({
                "kind": "mileage",
                "label": "Lower mileage",
                "detail": "Each ~10k fewer miles is worth roughly this much on this car.",
                "delta": int(round(per10k)),
            })

    recs.sort(key=lambda r: r["delta"], reverse=True)
    return recs


def _percentile_of(value, qs, vs):
    if value <= vs[0]:
        return float(qs[0])
    if value >= vs[-1]:
        return float(qs[-1])
    return float(np.interp(value, vs, qs))


def market_context(base, estimate):
    manu = base.get("manufacturer")
    btype = base.get("type")
    seg_key = f"{manu}|{btype}"
    if seg_key in INTEL["by_segment"]:
        seg = INTEL["by_segment"][seg_key]
        label = f"{manu} {btype}".strip()
        scope = "segment"
    elif manu in INTEL["by_manufacturer"]:
        seg = INTEL["by_manufacturer"][manu]
        label = str(manu)
        scope = "manufacturer"
    else:
        seg = INTEL["global"]
        label = "all vehicles"
        scope = "global"

    pct = _percentile_of(estimate, seg["pct_q"], seg["pct_v"])
    manu_block = INTEL["by_manufacturer"].get(manu, {})
    return {
        "scope": scope,
        "segment_label": label,
        "comparable_count": seg["count"],
        "segment_median": seg["median"],
        "segment_low": seg["pct_v"][1],
        "segment_high": seg["pct_v"][-2],
        "percentile": round(pct),
        "vs_median": int(round(estimate - seg["median"])),
        "depreciation": manu_block.get("depreciation"),
        "reference_rows": INTEL["meta"]["reference_rows"],
        "popular_models": INTEL.get("popular_models", {}).get(manu, [])[:4],
    }


def slim_analysis(p):
    point, lo, hi, grp = predict_with_interval(p)
    drivers = value_drivers(p, point)
    recs = recommendations(p, point)
    fc = depreciation_forecast(p, point)
    mkt = market_context(p, point)
    top = drivers[0] if drivers else None
    return {
        "label": p.get("_label") or f"{p.get('year')} {p.get('manufacturer')} {p.get('model')}".strip(),
        "estimate": int(round(point)),
        "low": int(round(lo)),
        "high": int(round(hi)),
        "known_model": grp != "other",
        "retained_3yr_pct": round(fc["value_in_3yr"] / point * 100, 1) if point else None,
        "value_in_3yr": fc["value_in_3yr"],
        "avg_annual_loss": fc["avg_annual_loss"],
        "percentile": mkt["percentile"],
        "segment_median": mkt["segment_median"],
        "vs_median": mkt["vs_median"],
        "top_driver": {"label": top["label"], "swing": top["swing"]} if top else None,
        "top_rec": recs[0] if recs else None,
    }

@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/options")
def api_options():
    return jsonify(OPTIONS)


@app.route("/api/intel")
def api_intel():
    return jsonify(INTEL)


@app.route("/predict", methods=["POST"])
def predict():
    p = request.get_json(force=True)
    try:
        point, lo, hi, grp = predict_with_interval(p)
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"invalid input: {e}"}), 400
    return jsonify({
        "price": round(point), "low": round(lo), "high": round(hi),
        "model_group": grp, "known_model": grp != "other",
    })


@app.route("/analyze", methods=["POST"])
def analyze():
    p = request.get_json(force=True)
    try:
        annual_miles = int(p.get("annual_miles") or 12000)
        point, lo, hi, grp = predict_with_interval(p)
        drivers = value_drivers(p, point)
        recs = recommendations(p, point)
        forecast = depreciation_forecast(p, point, annual_miles=annual_miles)
        miles = mileage_curve(p)
        mkt = market_context(p, point)
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"invalid input: {e}"}), 400

    return jsonify({
        "appraisal": {
            "estimate": int(round(point)),
            "low": int(round(lo)),
            "high": int(round(hi)),
            "spread_pct": round((hi - lo) / point * 100, 1) if point else None,
            "model_group": grp,
            "known_model": grp != "other",
        },
        "drivers": drivers,
        "recommendations": recs,
        "forecast": forecast,
        "mileage_curve": miles,
        "market": mkt,
        "vehicle": {k: p.get(k) for k in
                    ["manufacturer", "model", "year", "odometer", "condition",
                     "title_status", "cylinders", "fuel", "transmission",
                     "drive", "type", "paint_color", "state"]},
    })


@app.route("/compare", methods=["POST"])
def compare():
    payload = request.get_json(force=True)
    vehicles = payload.get("vehicles", [])[:4]
    if not vehicles:
        return jsonify({"error": "no vehicles provided"}), 400
    try:
        results = [slim_analysis(v) for v in vehicles]
    except (KeyError, ValueError) as e:
        return jsonify({"error": f"invalid input: {e}"}), 400

    if results:
        best_value = min(range(len(results)), key=lambda i: results[i]["estimate"])
        holds_value = max(range(len(results)),
                          key=lambda i: results[i]["retained_3yr_pct"] or 0)
        for i, r in enumerate(results):
            r["award_cheapest"] = (i == best_value)
            r["award_holds_value"] = (i == holds_value)
    return jsonify({"results": results})


if __name__ == "__main__":
    app.run(debug=False, host="0.0.0.0", port=5050)
