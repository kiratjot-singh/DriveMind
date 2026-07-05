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
    "speed",
    "acceleration",
    "brakePressure",
    "steeringAngle",
    "laneOffset",
    "distanceToFrontVehicle"
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
# Base Models
# ----------------------------
rf = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    class_weight="balanced"
)

gb = GradientBoostingClassifier(
    n_estimators=100,
    random_state=42
)

lr = LogisticRegression(
    max_iter=1000,
    random_state=42,
    class_weight="balanced"
)

# ----------------------------
# Voting Ensemble
# ----------------------------
voting_model = VotingClassifier(
    estimators=[
        ('rf', rf),
        ('gb', gb),
        ('lr', lr)
    ],
    voting='soft'      # use probabilities
)

# ----------------------------
# Train
# ----------------------------
voting_model.fit(X_train, y_train)

# ----------------------------
# Predict
# ----------------------------
y_pred = voting_model.predict(X_test)

# ----------------------------
# Evaluation
# ----------------------------
accuracy = accuracy_score(y_test, y_pred)

print("Voting Ensemble Model Trained")
print(f"Accuracy: {accuracy:.4f}")

print("\nClassification Report")
print(classification_report(y_test, y_pred))

print("\nConfusion Matrix")
print(confusion_matrix(y_test, y_pred))

# ----------------------------
# Save Model
# ----------------------------
joblib.dump(voting_model, MODEL_PATH)

print(f"\nModel saved at {MODEL_PATH}")
