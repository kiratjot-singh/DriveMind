from pathlib import Path


AI_SERVICE_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = AI_SERVICE_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
SAMPLES_DATA_DIR = DATA_DIR / "samples"
MODELS_DIR = AI_SERVICE_ROOT / "models"

SURAT_RAW_DIR = RAW_DATA_DIR / "surat"
SURAT_TRAJECTORY_FILE = SURAT_RAW_DIR / "Trajectorydatadumasroad.xlsx"
SURAT_FEATURES_FILE = PROCESSED_DATA_DIR / "surat_trajectory_features.csv"
SURAT_RISK_MODEL_FILE = MODELS_DIR / "surat_trajectory_risk_model.joblib"
SURAT_RISK_METRICS_FILE = MODELS_DIR / "surat_trajectory_risk_metrics.json"

ISEE_YOU_RAW_DIR = RAW_DATA_DIR / "isee_you"
ISEE_YOU_RESULTS_DIR = ISEE_YOU_RAW_DIR / "Results"
ISEE_YOU_VEHICLE_TRAJECTORIES_FILE = ISEE_YOU_RESULTS_DIR / "1_06_37_00_veh.csv"
ISEE_YOU_PEDESTRIAN_TRAJECTORIES_FILE = ISEE_YOU_RESULTS_DIR / "1_06_37_00_ped.csv"
ISEE_YOU_TRAJECTORY_SELECTION_FILE = ISEE_YOU_RAW_DIR / "scripts" / "trajectory_selection.py"
ISEE_YOU_LABELS_FILE = PROCESSED_DATA_DIR / "isee_you_real_labels.csv"
ISEE_YOU_FEATURES_FILE = PROCESSED_DATA_DIR / "isee_you_real_label_features.csv"
ISEE_YOU_MODEL_FILE = MODELS_DIR / "isee_you_real_label_model.joblib"
ISEE_YOU_METRICS_FILE = MODELS_DIR / "isee_you_real_label_metrics.json"
