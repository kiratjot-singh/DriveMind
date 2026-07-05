from __future__ import annotations

import re
from pathlib import Path

import pandas as pd

from app.data_pipeline.cleaner import clean_trajectory_frame
from app.data_pipeline.validator import ValidationReport, validate_trajectory_frame
from app.utils.config import (
    ISEE_YOU_LABELS_FILE,
    ISEE_YOU_PEDESTRIAN_TRAJECTORIES_FILE,
    ISEE_YOU_TRAJECTORY_SELECTION_FILE,
    ISEE_YOU_VEHICLE_TRAJECTORIES_FILE,
    PROCESSED_DATA_DIR,
    SURAT_TRAJECTORY_FILE,
)


SURAT_COLUMN_MAP = {
    "Vehicle No.": "vehicle_id",
    "Time (s)": "time_s",
    "vehicle type": "vehicle_type_id",
    "logitudinal": "x_m",
    "lateral": "y_m",
    "longitudinal speed": "speed_mps",
    "longitudinal accleration": "acceleration_mps2",
    "lateral velocity": "lateral_velocity_mps",
    "lateral acceleration": "lateral_acceleration_mps2",
}


def _read_table(path: Path, sheet_name: str | int | None = 0) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(path, sheet_name=sheet_name, header=23)
    if suffix == ".csv":
        return pd.read_csv(path)
    raise ValueError(f"Unsupported dataset file type: {path.suffix}")


def load_surat_trajectory(
    path: str | Path = SURAT_TRAJECTORY_FILE,
    sheet_name: str | int | None = 0,
) -> tuple[pd.DataFrame, ValidationReport]:
    dataset_path = Path(path)
    if not dataset_path.exists():
        raise FileNotFoundError(f"Surat trajectory dataset not found: {dataset_path}")

    raw = _read_table(dataset_path, sheet_name=sheet_name)
    raw.columns = [str(column).strip() for column in raw.columns]
    normalized = raw.rename(columns=SURAT_COLUMN_MAP)
    normalized = normalized.loc[:, list(SURAT_COLUMN_MAP.values())]

    cleaned = clean_trajectory_frame(normalized)
    report = validate_trajectory_frame(cleaned)
    return cleaned, report


def load_isee_you_real_labels(
    trajectory_selection_path: str | Path = ISEE_YOU_TRAJECTORY_SELECTION_FILE,
    vehicle_trajectory_path: str | Path = ISEE_YOU_VEHICLE_TRAJECTORIES_FILE,
) -> pd.DataFrame:
    selection_path = Path(trajectory_selection_path)
    vehicle_path = Path(vehicle_trajectory_path)

    if not selection_path.exists():
        raise FileNotFoundError(f"I See You selection file not found: {selection_path}")
    if not vehicle_path.exists():
        raise FileNotFoundError(f"I See You vehicle trajectory file not found: {vehicle_path}")

    available_clips = set(pd.read_csv(vehicle_path, usecols=["clip"])["clip"].astype(str).unique())
    pattern = re.compile(r"interaction_p\['(.+)'\]=ids_p\[(\d+)\]")
    records = []

    for line in selection_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            continue

        match = pattern.search(stripped)
        if not match:
            continue

        clip = match.group(1).replace(" ", "_")
        source_index = int(match.group(2))
        if clip not in available_clips:
            continue

        records.append(
            {
                "clip": clip,
                "source_index": source_index,
                "target": int(source_index <= 90),
                "target_label": "dangerous" if source_index <= 90 else "non_dangerous",
            }
        )

    labels = pd.DataFrame(records).drop_duplicates(subset=["clip"]).sort_values("source_index")

    if labels.empty:
        raise ValueError("No I See You real labels could be loaded")

    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    labels.to_csv(ISEE_YOU_LABELS_FILE, index=False)
    return labels


def load_isee_you_trajectories(
    vehicle_trajectory_path: str | Path = ISEE_YOU_VEHICLE_TRAJECTORIES_FILE,
    pedestrian_trajectory_path: str | Path = ISEE_YOU_PEDESTRIAN_TRAJECTORIES_FILE,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    vehicle_path = Path(vehicle_trajectory_path)
    pedestrian_path = Path(pedestrian_trajectory_path)

    if not vehicle_path.exists():
        raise FileNotFoundError(f"I See You vehicle trajectory file not found: {vehicle_path}")
    if not pedestrian_path.exists():
        raise FileNotFoundError(f"I See You pedestrian trajectory file not found: {pedestrian_path}")

    vehicle = pd.read_csv(vehicle_path)
    pedestrian = pd.read_csv(pedestrian_path)
    vehicle["clip"] = vehicle["clip"].astype(str).str.replace(" ", "_", regex=False)
    pedestrian["clip"] = pedestrian["clip"].astype(str).str.replace(" ", "_", regex=False)
    return vehicle, pedestrian


if __name__ == "__main__":
    frame, validation = load_surat_trajectory()
    print(validation)
    print(frame.head())
