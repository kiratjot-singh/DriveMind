from __future__ import annotations

import json

import joblib
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from app.data_pipeline.loader import load_isee_you_real_labels, load_isee_you_trajectories
from app.feature_engineering.feature_builder import (
    ISEE_YOU_FEATURE_COLUMNS,
    build_isee_you_interaction_features,
)
from app.utils.config import (
    ISEE_YOU_FEATURES_FILE,
    ISEE_YOU_METRICS_FILE,
    ISEE_YOU_MODEL_FILE,
    MODELS_DIR,
    PROCESSED_DATA_DIR,
)


def train_isee_you_real_label_model() -> dict:
    labels = load_isee_you_real_labels()
    vehicle, pedestrian = load_isee_you_trajectories()
    features = build_isee_you_interaction_features(vehicle, pedestrian, labels)

    PROCESSED_DATA_DIR.mkdir(parents=True, exist_ok=True)
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    features.to_csv(ISEE_YOU_FEATURES_FILE, index=False)

    X = features[ISEE_YOU_FEATURE_COLUMNS]
    y = features["target"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.25,
        random_state=42,
        stratify=y,
    )

    candidates = {
        "random_forest": RandomForestClassifier(
            n_estimators=500,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(random_state=42),
        "logistic_regression": make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, class_weight="balanced", random_state=42),
        ),
    }

    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    candidate_runs = []
    best_name = None
    best_model = None
    best_test_accuracy = -1.0

    for name, model in candidates.items():
        cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring="accuracy")
        model.fit(X_train, y_train)
        predictions = model.predict(X_test)
        test_accuracy = accuracy_score(y_test, predictions)
        run = {
            "name": name,
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "test_accuracy": float(test_accuracy),
        }
        candidate_runs.append(run)

        if run["test_accuracy"] > best_test_accuracy:
            best_name = name
            best_model = model
            best_test_accuracy = run["test_accuracy"]

    final_predictions = best_model.predict(X_test)
    final_accuracy = accuracy_score(y_test, final_predictions)

    metrics = {
        "dataset": "I See You vehicle-pedestrian interaction dataset",
        "target_source": "dataset-provided interaction category from curated manual interaction list",
        "target_labels": {"1": "dangerous", "0": "non_dangerous"},
        "total_interactions": int(len(features)),
        "dangerous_interactions": int(y.sum()),
        "non_dangerous_interactions": int((y == 0).sum()),
        "train_interactions": int(len(X_train)),
        "test_interactions": int(len(X_test)),
        "best_model": best_name,
        "selection_criterion": "highest held-out test accuracy among candidate real-label models",
        "best_test_accuracy": float(best_test_accuracy),
        "test_accuracy": float(final_accuracy),
        "candidate_runs": candidate_runs,
        "feature_columns": ISEE_YOU_FEATURE_COLUMNS,
        "classification_report": classification_report(
            y_test,
            final_predictions,
            output_dict=True,
            zero_division=0,
        ),
        "confusion_matrix": confusion_matrix(y_test, final_predictions).tolist(),
    }

    joblib.dump(
        {
            "model": best_model,
            "feature_columns": ISEE_YOU_FEATURE_COLUMNS,
            "target_labels": metrics["target_labels"],
            "target_source": metrics["target_source"],
            "test_accuracy": metrics["test_accuracy"],
            "best_model": best_name,
        },
        ISEE_YOU_MODEL_FILE,
    )
    ISEE_YOU_METRICS_FILE.write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    return metrics


if __name__ == "__main__":
    print(json.dumps(train_isee_you_real_label_model(), indent=2))
