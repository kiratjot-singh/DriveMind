from __future__ import annotations

from dataclasses import dataclass

import pandas as pd


REQUIRED_TRAJECTORY_COLUMNS = (
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


@dataclass(frozen=True)
class ValidationReport:
    rows: int
    vehicles: int
    min_time_s: float
    max_time_s: float


def validate_trajectory_frame(df: pd.DataFrame) -> ValidationReport:
    missing = [column for column in REQUIRED_TRAJECTORY_COLUMNS if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required trajectory columns: {missing}")

    if df.empty:
        raise ValueError("Trajectory data is empty")

    null_counts = df.loc[:, REQUIRED_TRAJECTORY_COLUMNS].isna().sum()
    columns_with_nulls = null_counts[null_counts > 0]
    if not columns_with_nulls.empty:
        raise ValueError(
            "Trajectory data contains nulls in required columns: "
            f"{columns_with_nulls.to_dict()}"
        )

    duplicate_rows = df.duplicated(subset=["vehicle_id", "time_s"]).sum()
    if duplicate_rows:
        raise ValueError(f"Found {duplicate_rows} duplicate vehicle/time records")

    if (df["time_s"] < 0).any():
        raise ValueError("Trajectory data contains negative timestamps")

    return ValidationReport(
        rows=len(df),
        vehicles=df["vehicle_id"].nunique(),
        min_time_s=float(df["time_s"].min()),
        max_time_s=float(df["time_s"].max()),
    )
