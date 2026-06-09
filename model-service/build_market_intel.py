import json
from pathlib import Path

import numpy as np
import pandas as pd

RANDOM_STATE = 42
HERE = Path(__file__).parent
DATA = HERE.parent / "vehicles.csv"

usecols = ["price", "year", "manufacturer", "model", "condition", "cylinders",
           "fuel", "odometer", "title_status", "transmission", "drive",
           "type", "paint_color", "state"]
print("reading data…")
df = pd.read_csv(DATA, usecols=usecols)

df = df.dropna(subset=["year", "manufacturer", "model", "odometer", "fuel",
                       "transmission", "title_status"])
df = df[(df["price"] >= 1000) & (df["price"] <= 80000)]
df = df[(df["odometer"] >= 100) & (df["odometer"] <= 300000)]
df = df[(df["year"] >= 1990) & (df["year"] <= 2021)]
df["cylinders"] = df["cylinders"].str.extract(r"(\d+)").astype(float)
df["cylinders"] = df["cylinders"].fillna(df["cylinders"].median())
for c in ["condition", "drive", "type", "paint_color"]:
    df[c] = df[c].fillna("unknown")
df["model"] = (df["model"].str.lower().str.strip()
                          .str.replace(r"[^a-z0-9 ]", "", regex=True))

df20 = df.sample(n=20000, random_state=RANDOM_STATE).reset_index(drop=True)
df20["vehicle_age"] = 2021 - df20["year"]
print(f"reference set: {len(df20)} rows")

DECILE_Q = [5, 10, 25, 50, 75, 90, 95]


def price_summary(frame):
    p = frame["price"].to_numpy()
    pcts = np.percentile(p, DECILE_Q)
    return {
        "count": int(len(frame)),
        "median": int(np.median(p)),
        "mean": int(round(p.mean())),
        "pct_q": DECILE_Q,
        "pct_v": [int(round(v)) for v in pcts],
        "avg_odometer": int(round(frame["odometer"].mean())),
        "median_age": float(frame["vehicle_age"].median()),
    }


def depreciation(frame):
    if frame["vehicle_age"].nunique() < 3 or len(frame) < 40:
        return None
    slope, intercept = np.polyfit(frame["vehicle_age"], frame["price"], 1)
    med = float(np.median(frame["price"]))
    return {
        "dollars_per_year": int(round(-slope)),
        "pct_per_year": round(-slope / med * 100, 1) if med else None,
    }


intel = {
    "meta": {
        "reference_rows": int(len(df20)),
        "source": "Craigslist used-vehicle listings, scraped April 2021",
        "year_range": [int(df20["year"].min()), int(df20["year"].max())],
        "price_floor": 1000,
        "price_ceiling": 80000,
    },
    "global": price_summary(df20),
}

by_manu = {}
for manu, g in df20.groupby("manufacturer"):
    if len(g) < 15:
        continue
    s = price_summary(g)
    s["depreciation"] = depreciation(g)
    by_manu[manu] = s
intel["by_manufacturer"] = by_manu

by_type = {}
for t, g in df20.groupby("type"):
    if len(g) < 15:
        continue
    by_type[t] = price_summary(g)
intel["by_type"] = by_type

by_segment = {}
for (manu, t), g in df20.groupby(["manufacturer", "type"]):
    if len(g) < 30:
        continue
    by_segment[f"{manu}|{t}"] = price_summary(g)
intel["by_segment"] = by_segment

mile_bins = list(range(0, 300001, 25000))
df20["_mb"] = pd.cut(df20["odometer"], bins=mile_bins, include_lowest=True)
mileage_curve = []
for interval, g in df20.groupby("_mb", observed=True):
    if len(g) < 20:
        continue
    mileage_curve.append({
        "miles": int(interval.right),
        "median_price": int(np.median(g["price"])),
        "count": int(len(g)),
    })
intel["mileage_curve"] = mileage_curve

age_curve = []
for age, g in df20.groupby("vehicle_age"):
    if len(g) < 20:
        continue
    age_curve.append({"age": int(age), "median_price": int(np.median(g["price"]))})
intel["age_curve"] = age_curve

popular = {}
for manu, g in df20.groupby("manufacturer"):
    top = g["model"].value_counts().head(5)
    popular[manu] = [{"model": m, "count": int(c)} for m, c in top.items()]
intel["popular_models"] = popular

out = HERE / "market_intel.json"
out.write_text(json.dumps(intel, separators=(",", ":")))
kb = out.stat().st_size / 1024
print(f"saved {out.name}  ({kb:.0f} KB)")
print(f"  manufacturers: {len(by_manu)}  types: {len(by_type)}  segments: {len(by_segment)}")
print(f"  global median ${intel['global']['median']:,}  rows {intel['global']['count']:,}")
