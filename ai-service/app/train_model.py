import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from sklearn.ensemble import RandomForestClassifier
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import VotingClassifier

# ----------------------------
# Paths
# ----------------------------
DATA_PATH = "data/real_intent_training_data.csv"
MODEL_PATH = "models/intent_model.joblib"

# ----------------------------
# Load Dataset
# ----------------------------
df = pd.read_csv(DATA_PATH)

features = [
    "speed", "acceleration", "brakePressure", "steeringAngle", "laneOffset", "distanceToFrontVehicle",
    "speed_sq", "speed_dist_ratio", "steering_speed", "abs_steering_speed",
    "safe_margin", "abs_steering", "accel_steering"
]
for lag in [5, 10, 15, 20, 25, 30, 45]:
    features.extend([f"speed_lag_{lag}", f"steering_lag_{lag}", f"accel_lag_{lag}", f"lane_offset_lag_{lag}"])
for win in [10, 15, 30, 45]:
    features.extend([f"speed_mean_{win}", f"speed_std_{win}", f"steering_mean_{win}", f"steering_std_{win}", f"accel_mean_{win}", f"accel_std_{win}"])

X = df[features]
y = df["intent"]

# ----------------------------
# Split Dataset
# ----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# ----------------------------
# Model Configuration (Ultimate Random Forest Classifier)
# ----------------------------
model = RandomForestClassifier(
    n_estimators=500,
    random_state=42,
    class_weight="balanced",
    n_jobs=-1
)

# ----------------------------
# Train
# ----------------------------
model.fit(X_train, y_train)

# ----------------------------
# Predict
# ----------------------------
y_pred = model.predict(X_test)

# ----------------------------
# Evaluation
# ----------------------------
accuracy = accuracy_score(y_test, y_pred)

print("Random Forest Classifier Model Trained")
print(f"Accuracy: {accuracy:.4f}")

print("\nClassification Report")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix")
print(confusion_matrix(y_test, y_pred))

# ----------------------------
# Save Model
# ----------------------------
joblib.dump(model, MODEL_PATH)

print(f"\nModel saved at {MODEL_PATH}")
