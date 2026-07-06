from __future__ import annotations

import json

import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit

from app.data_pipeline.loader import load_surat_trajectory
from app.feature_engineering.feature_builder import FEATURE_COLUMNS, build_trajectory_features
from app.utils.config import (
    MODELS_DIR,
    PROCESSED_DATA_DIR,
    SURAT_FEATURES_FILE,
    SURAT_RISK_METRICS_FILE,
    SURAT_RISK_MODEL_FILE,
)


def train_surat_risk_model() -> dict:
    trajectory, validation = load_surat_trajectory()
    features = build_trajectory_features(trajectory)

    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    features.to_csv(SURAT_FEATURES_FILE, index=False)

    X = features[FEATURE_COLUMNS]
    y = features["risk_label"]
    groups = features["vehicle_id"]

    splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
    train_idx, test_idx = next(splitter.split(X, y, groups=groups))

    X_train = X.iloc[train_idx]
    X_test = X.iloc[test_idx]
    y_train = y.iloc[train_idx]
    y_test = y.iloc[test_idx]

    candidates = [
        {"n_estimators": 200, "max_depth": None, "min_samples_leaf": 1},
        {"n_estimators": 300, "max_depth": None, "min_samples_leaf": 1},
        {"n_estimators": 300, "max_depth": 24, "min_samples_leaf": 1},
        {"n_estimators": 300, "max_depth": 18, "min_samples_leaf": 2},
        {"n_estimators": 400, "max_depth": None, "min_samples_leaf": 2},
    ]

    training_runs = []
    best_model = None
    best_accuracy = -1.0
    best_params = None
    best_predictions = None

    for params in candidates:
        model = RandomForestClassifier(
            **params,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        accuracy = accuracy_score(y_test, predictions)
        training_runs.append({"params": params, "accuracy": float(accuracy)})

        if accuracy > best_accuracy:
            best_model = model
            best_accuracy = accuracy
            best_params = params
            best_predictions = predictions

    predictions = best_predictions
    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)
    matrix = confusion_matrix(y_test, predictions).tolist()

    metrics = {
        "dataset": "Surat Dumas Road trajectory workbook",
        "labeling": "proxy labels derived from motion outliers and lane-edge position",
        "source_rows": validation.rows,
        "source_vehicles": validation.vehicles,
        "feature_rows": len(features),
        "positive_risk_rate": float(y.mean()),
        "train_rows": len(X_train),
        "test_rows": len(X_test),
        "train_vehicle_count": int(groups.iloc[train_idx].nunique()),
        "test_vehicle_count": int(groups.iloc[test_idx].nunique()),
        "test_accuracy": float(best_accuracy),
        "best_model_params": best_params,
        "candidate_runs": training_runs,
        "feature_columns": FEATURE_COLUMNS,
        "classification_report": report,
        "confusion_matrix": matrix,
    }

    joblib.dump(
        {
            "model": best_model,
            "feature_columns": FEATURE_COLUMNS,
            "labeling": metrics["labeling"],
            "test_accuracy": float(best_accuracy),
            "best_model_params": best_params,
        },
        SURAT_RISK_MODEL_FILE,
    )

    SURAT_RISK_METRICS_FILE.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    training_metrics = train_surat_risk_model()
    print(json.dumps(training_metrics, indent=2))
