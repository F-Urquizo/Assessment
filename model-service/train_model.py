import json
import numpy as np
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestRegressor

RANDOM_STATE = 42
HERE = Path(__file__).parent
DATA = HERE.parent / "vehicles.csv"

usecols = ["price", "year", "manufacturer", "model", "condition", "cylinders",
           "fuel", "odometer", "title_status", "transmission", "drive",
           "type", "paint_color", "state"]
df = pd.read_csv(DATA, usecols=usecols)

df = df.dropna(subset=["year", "manufacturer", "model", "odometer", "fuel",
                       "transmission", "title_status"])
df = df[(df["price"] >= 1000) & (df["price"] <= 80000)]
df = df[(df["odometer"] >= 100) & (df["odometer"] <= 300000)]
df = df[(df["year"] >= 1990) & (df["year"] <= 2021)]
df["cylinders"] = df["cylinders"].str.extract(r"(\d+)").astype(float)
cyl_median = df["cylinders"].median()
df["cylinders"] = df["cylinders"].fillna(cyl_median)
for c in ["condition", "drive", "type", "paint_color"]:
    df[c] = df[c].fillna("unknown")
df["model"] = (df["model"].str.lower().str.strip()
                          .str.replace(r"[^a-z0-9 ]", "", regex=True))

df20 = df.sample(n=20000, random_state=RANDOM_STATE).reset_index(drop=True)
df20["vehicle_age"] = 2021 - df20["year"]
model_counts = df20["model"].value_counts()
df20["model_grp"] = df20["model"].where(df20["model"].map(model_counts) >= 20, "other")

y = np.log1p(df20["price"])

def fit_target_encoding(series, y, smoothing=10):
    global_mean = y.mean()
    stats = y.groupby(series).agg(["mean", "count"])
    enc = (stats["mean"] * stats["count"] + global_mean * smoothing) / (stats["count"] + smoothing)
    return enc.to_dict(), global_mean

te_maps = {}
global_mean = y.mean()
X = df20[["vehicle_age", "odometer", "cylinders", "manufacturer", "model_grp",
          "condition", "fuel", "title_status", "transmission", "drive",
          "type", "paint_color", "state"]].copy()
for col in ["manufacturer", "model_grp", "state"]:
    te_maps[col], _ = fit_target_encoding(X[col], y)
    X[col + "_te"] = X[col].map(te_maps[col]).fillna(global_mean)
    X = X.drop(columns=col)

onehot_cols = ["condition", "fuel", "title_status", "transmission", "drive", "type", "paint_color"]
X = pd.get_dummies(X, columns=onehot_cols)
feature_columns = list(X.columns)

rf = RandomForestRegressor(n_estimators=400, max_features=0.4, min_samples_leaf=1,
                           min_samples_split=4, n_jobs=-1,
                           random_state=RANDOM_STATE)
rf.fit(X, y)
print(f"trained on {X.shape[0]} rows, {X.shape[1]} features")

manufacturer_models = (
    df20[df20["model_grp"] != "other"]
    .groupby("manufacturer")["model_grp"]
    .apply(lambda s: sorted(s.unique().tolist()))
    .to_dict()
)
options = {
    "manufacturers": sorted(df20["manufacturer"].unique().tolist()),
    "manufacturer_models": manufacturer_models,
    "conditions": sorted(df20["condition"].unique().tolist()),
    "fuels": sorted(df20["fuel"].unique().tolist()),
    "title_statuses": sorted(df20["title_status"].unique().tolist()),
    "transmissions": sorted(df20["transmission"].unique().tolist()),
    "drives": sorted(df20["drive"].unique().tolist()),
    "types": sorted(df20["type"].unique().tolist()),
    "paint_colors": sorted(df20["paint_color"].unique().tolist()),
    "states": sorted(df20["state"].unique().tolist()),
    "cylinders": sorted(df20["cylinders"].unique().tolist()),
    "year_range": [int(df20["year"].min()), int(df20["year"].max())],
}

joblib.dump({
    "model": rf,
    "te_maps": te_maps,
    "global_mean": float(global_mean),
    "feature_columns": feature_columns,
    "cyl_median": float(cyl_median),
}, HERE / "model_artifacts.joblib", compress=3)
with open(HERE / "options.json", "w") as f:
    json.dump(options, f)
print("saved model_artifacts.joblib + options.json")
