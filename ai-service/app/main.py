from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import os
import numpy as np
import pandas as pd
from typing import Optional

app = FastAPI(title="DriveMind AI Service")

MODEL_PATH = "models/intent_model.joblib"
model = None

if os.path.exists(MODEL_PATH):
    model = joblib.load(MODEL_PATH)

# In-memory history buffer (vehicle_id -> list of past 45 telemetry dicts)
VEHICLE_HISTORY = {}

class IntentRequest(BaseModel):
    speed: float
    acceleration: float
    brakePressure: float
    steeringAngle: float
    laneOffset: float
    distanceToFrontVehicle: float
    vehicleId: Optional[str] = None


@app.get("/")
def root():
    return {
        "message": "DriveMind AI service is running"
    }


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "DriveMind AI Service",
        "modelLoaded": model is not None
    }


@app.post("/predict-intent")
def predict_intent(data: IntentRequest):
    if model is None:
        return {
            "success": False,
            "message": "Intent model not found. Train the model first."
        }

    vehicle_id = data.vehicleId or "default"
    if vehicle_id not in VEHICLE_HISTORY:
        VEHICLE_HISTORY[vehicle_id] = []
        
    current_frame = {
        "speed": data.speed,
        "acceleration": data.acceleration,
        "brakePressure": data.brakePressure,
        "steeringAngle": data.steeringAngle,
        "laneOffset": data.laneOffset,
        "distanceToFrontVehicle": data.distanceToFrontVehicle
    }
    
    VEHICLE_HISTORY[vehicle_id].append(current_frame)
    if len(VEHICLE_HISTORY[vehicle_id]) > 45:
        VEHICLE_HISTORY[vehicle_id].pop(0)
        
    history = VEHICLE_HISTORY[vehicle_id]
    n = len(history)
    
    # 1. Physical Interaction Features
    speed_sq = data.speed ** 2
    speed_dist_ratio = data.speed / (data.distanceToFrontVehicle + 1.0)
    steering_speed = data.steeringAngle * data.speed
    abs_steering_speed = abs(data.steeringAngle) * data.speed
    safe_margin = data.distanceToFrontVehicle - (data.speed / 3.6 * 1.5)
    abs_steering = abs(data.steeringAngle)
    accel_steering = data.acceleration * data.steeringAngle
    
    features_dict = {
        "speed": data.speed,
        "acceleration": data.acceleration,
        "brakePressure": data.brakePressure,
        "steeringAngle": data.steeringAngle,
        "laneOffset": data.laneOffset,
        "distanceToFrontVehicle": data.distanceToFrontVehicle,
        "speed_sq": speed_sq,
        "speed_dist_ratio": speed_dist_ratio,
        "steering_speed": steering_speed,
        "abs_steering_speed": abs_steering_speed,
        "safe_margin": safe_margin,
        "abs_steering": abs_steering,
        "accel_steering": accel_steering
    }
    
    # 2. Dense history lags: 5, 10, 15, 20, 25, 30, 45
    for lag in [5, 10, 15, 20, 25, 30, 45]:
        target_idx = max(0, n - 1 - lag)
        features_dict[f"speed_lag_{lag}"] = history[target_idx]["speed"]
        features_dict[f"steering_lag_{lag}"] = history[target_idx]["steeringAngle"]
        features_dict[f"accel_lag_{lag}"] = history[target_idx]["acceleration"]
        features_dict[f"lane_offset_lag_{lag}"] = history[target_idx]["laneOffset"]
        
    # 3. Rolling window statistics: 10, 15, 30, 45
    speeds = [f["speed"] for f in history]
    steerings = [f["steeringAngle"] for f in history]
    accels = [f["acceleration"] for f in history]
    
    for win in [10, 15, 30, 45]:
        speeds_win = speeds[-win:]
        steerings_win = steerings[-win:]
        accels_win = accels[-win:]
        
        features_dict[f"speed_mean_{win}"] = float(np.mean(speeds_win))
        features_dict[f"speed_std_{win}"] = float(np.std(speeds_win)) if len(speeds_win) > 1 else 0.0
        
        features_dict[f"steering_mean_{win}"] = float(np.mean(steerings_win))
        features_dict[f"steering_std_{win}"] = float(np.std(steerings_win)) if len(steerings_win) > 1 else 0.0
        
        features_dict[f"accel_mean_{win}"] = float(np.mean(accels_win))
        features_dict[f"accel_std_{win}"] = float(np.std(accels_win)) if len(accels_win) > 1 else 0.0
        
    # Create DataFrame for prediction
    features_df = pd.DataFrame([features_dict])

    prediction = model.predict(features_df)[0]
    probabilities = model.predict_proba(features_df)[0]
    confidence = float(max(probabilities))

    return {
        "success": True,
        "predictedIntent": prediction,
        "confidence": round(confidence, 2)
    }