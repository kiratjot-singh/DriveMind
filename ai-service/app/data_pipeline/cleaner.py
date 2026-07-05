from __future__ import annotations

import pandas as pd


VEHICLE_TYPE_LABELS = {
    1: "auto",
    2: "bike",
    3: "bus",
    4: "car",
    5: "truck",
    6: "lcv",
}


NUMERIC_COLUMNS = (
    "vehicle_id",
    "time_s",
    "vehicle_type_id",
    "x_m",
    "y_m",
    "speed_mps",
    "acceleration_mps2",
    "lateral_velocity_mps",
    "lateral_acceleration_mps2",
)


def clean_trajectory_frame(df: pd.DataFrame) -> pd.DataFrame:
    cleaned = df.copy()

    for column in NUMERIC_COLUMNS:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    cleaned = cleaned.dropna(subset=NUMERIC_COLUMNS)
    cleaned["vehicle_id"] = cleaned["vehicle_id"].astype("int64")
    cleaned["vehicle_type_id"] = cleaned["vehicle_type_id"].astype("int64")
    cleaned["vehicle_type"] = cleaned["vehicle_type_id"].map(VEHICLE_TYPE_LABELS).fillna("unknown")

    cleaned = cleaned.sort_values(["vehicle_id", "time_s"]).reset_index(drop=True)
    return cleaned
