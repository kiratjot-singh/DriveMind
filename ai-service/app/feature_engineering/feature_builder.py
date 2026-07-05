from __future__ import annotations

import numpy as np
import pandas as pd


FEATURE_COLUMNS = [
    "speed_mps",
    "acceleration_mps2",
    "lateral_velocity_mps",
    "lateral_acceleration_mps2",
    "longitudinal_jerk_mps3",
    "lateral_jerk_mps3",
    "abs_acceleration_mps2",
    "abs_lateral_velocity_mps",
    "abs_lateral_acceleration_mps2",
    "distance_from_lane_center_m",
    "lane_edge_margin_m",
    "vehicle_type_id",
]


def build_trajectory_features(df: pd.DataFrame) -> pd.DataFrame:
    features = df.copy()
    grouped = features.groupby("vehicle_id", sort=False)

    time_delta = grouped["time_s"].diff()
    features["longitudinal_jerk_mps3"] = grouped["acceleration_mps2"].diff() / time_delta
    features["lateral_jerk_mps3"] = grouped["lateral_acceleration_mps2"].diff() / time_delta

    features["abs_acceleration_mps2"] = features["acceleration_mps2"].abs()
    features["abs_lateral_velocity_mps"] = features["lateral_velocity_mps"].abs()
    features["abs_lateral_acceleration_mps2"] = features["lateral_acceleration_mps2"].abs()

    lane_width_m = 3.5
    road_width_m = 10.5
    nearest_lane_center = ((features["y_m"] / lane_width_m).round() * lane_width_m).clip(
        lower=lane_width_m / 2,
        upper=road_width_m - lane_width_m / 2,
    )
    features["distance_from_lane_center_m"] = (features["y_m"] - nearest_lane_center).abs()
    features["lane_edge_margin_m"] = np.minimum(features["y_m"], road_width_m - features["y_m"])

    features = features.replace([np.inf, -np.inf], np.nan)
    features[["longitudinal_jerk_mps3", "lateral_jerk_mps3"]] = features[
        ["longitudinal_jerk_mps3", "lateral_jerk_mps3"]
    ].fillna(0.0)

    features["risk_label"] = make_proxy_risk_labels(features)
    return features


def make_proxy_risk_labels(df: pd.DataFrame) -> pd.Series:
    hard_braking = df["acceleration_mps2"] <= df["acceleration_mps2"].quantile(0.05)
    hard_acceleration = df["acceleration_mps2"] >= df["acceleration_mps2"].quantile(0.95)
    lateral_motion = df["abs_lateral_velocity_mps"] >= df["abs_lateral_velocity_mps"].quantile(0.95)
    lateral_acceleration = df["abs_lateral_acceleration_mps2"] >= df[
        "abs_lateral_acceleration_mps2"
    ].quantile(0.95)
    jerk = df["longitudinal_jerk_mps3"].abs() >= df["longitudinal_jerk_mps3"].abs().quantile(0.95)
    near_lane_edge = df["lane_edge_margin_m"] <= 0.35

    return (
        hard_braking
        | hard_acceleration
        | lateral_motion
        | lateral_acceleration
        | jerk
        | near_lane_edge
    ).astype(int)


ISEE_YOU_FEATURE_COLUMNS = [
    "duration_s",
    "overlap_duration_s",
    "vehicle_distance_m",
    "pedestrian_distance_m",
    "vehicle_mean_speed_mps",
    "vehicle_max_speed_mps",
    "vehicle_std_speed_mps",
    "pedestrian_mean_speed_mps",
    "pedestrian_max_speed_mps",
    "pedestrian_std_speed_mps",
    "min_distance_m",
    "mean_distance_m",
    "distance_at_closest_m",
    "relative_speed_at_closest_mps",
    "closing_speed_max_mps",
]


def build_isee_you_interaction_features(
    vehicle: pd.DataFrame,
    pedestrian: pd.DataFrame,
    labels: pd.DataFrame,
    fps: float = 30.0,
) -> pd.DataFrame:
    rows = []
    label_lookup = labels.set_index("clip")

    for clip, label_row in label_lookup.iterrows():
        veh_clip = vehicle.loc[vehicle["clip"].astype(str) == clip].copy()
        ped_clip = pedestrian.loc[pedestrian["clip"].astype(str) == clip].copy()

        if veh_clip.empty or ped_clip.empty:
            continue

        veh_motion = _motion_features(veh_clip, fps=fps)
        ped_motion = _motion_features(ped_clip, fps=fps)
        joined = veh_motion.merge(
            ped_motion,
            on="frame",
            suffixes=("_vehicle", "_pedestrian"),
        )

        if joined.empty:
            min_distance_m = np.nan
            mean_distance_m = np.nan
            distance_at_closest_m = np.nan
            relative_speed_at_closest_mps = np.nan
            closing_speed_max_mps = np.nan
            overlap_duration_s = 0.0
        else:
            distances = _haversine_m(
                joined["latitude_vehicle"],
                joined["longitude_vehicle"],
                joined["latitude_pedestrian"],
                joined["longitude_pedestrian"],
            )
            closest_idx = int(np.nanargmin(distances))
            relative_speed = np.hypot(
                joined["velocity_x_mps_vehicle"] - joined["velocity_x_mps_pedestrian"],
                joined["velocity_y_mps_vehicle"] - joined["velocity_y_mps_pedestrian"],
            )
            distance_delta = pd.Series(distances).diff()
            closing_speed = -(distance_delta / (1.0 / fps))

            min_distance_m = float(np.nanmin(distances))
            mean_distance_m = float(np.nanmean(distances))
            distance_at_closest_m = float(distances[closest_idx])
            relative_speed_at_closest_mps = float(relative_speed.iloc[closest_idx])
            closing_speed_max_mps = float(closing_speed.max(skipna=True))
            overlap_duration_s = float(joined["frame"].nunique() / fps)

        rows.append(
            {
                "clip": clip,
                "target": int(label_row["target"]),
                "target_label": label_row["target_label"],
                "duration_s": float(
                    (
                        max(veh_clip["frame"].max(), ped_clip["frame"].max())
                        - min(veh_clip["frame"].min(), ped_clip["frame"].min())
                    )
                    / fps
                ),
                "overlap_duration_s": overlap_duration_s,
                "vehicle_distance_m": float(veh_motion["step_distance_m"].sum()),
                "pedestrian_distance_m": float(ped_motion["step_distance_m"].sum()),
                "vehicle_mean_speed_mps": float(veh_motion["speed_mps"].mean()),
                "vehicle_max_speed_mps": float(veh_motion["speed_mps"].max()),
                "vehicle_std_speed_mps": float(veh_motion["speed_mps"].std(ddof=0)),
                "pedestrian_mean_speed_mps": float(ped_motion["speed_mps"].mean()),
                "pedestrian_max_speed_mps": float(ped_motion["speed_mps"].max()),
                "pedestrian_std_speed_mps": float(ped_motion["speed_mps"].std(ddof=0)),
                "min_distance_m": min_distance_m,
                "mean_distance_m": mean_distance_m,
                "distance_at_closest_m": distance_at_closest_m,
                "relative_speed_at_closest_mps": relative_speed_at_closest_mps,
                "closing_speed_max_mps": closing_speed_max_mps,
            }
        )

    features = pd.DataFrame(rows)
    features[ISEE_YOU_FEATURE_COLUMNS] = features[ISEE_YOU_FEATURE_COLUMNS].replace(
        [np.inf, -np.inf], np.nan
    )
    features[ISEE_YOU_FEATURE_COLUMNS] = features[ISEE_YOU_FEATURE_COLUMNS].fillna(0.0)
    return features


def _motion_features(df: pd.DataFrame, fps: float) -> pd.DataFrame:
    motion = df.sort_values(["id", "frame"]).copy()
    prev_lat = motion.groupby("id")["latitude"].shift()
    prev_lon = motion.groupby("id")["longitude"].shift()
    frame_delta = motion.groupby("id")["frame"].diff() / fps

    step_distance = _haversine_m(prev_lat, prev_lon, motion["latitude"], motion["longitude"])
    motion["step_distance_m"] = pd.Series(step_distance).fillna(0.0).to_numpy()
    motion["speed_mps"] = (motion["step_distance_m"] / frame_delta).replace(
        [np.inf, -np.inf], np.nan
    ).fillna(0.0)

    mean_lat_rad = np.radians(motion["latitude"])
    lat_delta_m = (motion["latitude"] - prev_lat) * 111_320.0
    lon_delta_m = (motion["longitude"] - prev_lon) * 111_320.0 * np.cos(mean_lat_rad)
    motion["velocity_y_mps"] = (lat_delta_m / frame_delta).replace(
        [np.inf, -np.inf], np.nan
    ).fillna(0.0)
    motion["velocity_x_mps"] = (lon_delta_m / frame_delta).replace(
        [np.inf, -np.inf], np.nan
    ).fillna(0.0)
    return motion


def _haversine_m(lat1, lon1, lat2, lon2):
    radius_m = 6_371_000.0
    lat1 = np.radians(lat1.astype(float))
    lon1 = np.radians(lon1.astype(float))
    lat2 = np.radians(lat2.astype(float))
    lon2 = np.radians(lon2.astype(float))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = np.sin(dlat / 2.0) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2.0) ** 2
    return radius_m * 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
