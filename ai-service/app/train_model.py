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
    "speed_lag_15", "speed_lag_30", "steering_lag_15", "steering_lag_30",
    "accel_lag_15", "lane_offset_lag_15",
    "speed_mean_15", "speed_std_15", "speed_mean_30", "speed_std_30",
    "steering_mean_15", "steering_std_15", "steering_mean_30", "steering_std_30",
    "accel_mean_15", "accel_std_15", "accel_mean_30", "accel_std_30"
]

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
# Model Configuration (Random Forest Classifier)
# ----------------------------
model = RandomForestClassifier(
    n_estimators=300,
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
