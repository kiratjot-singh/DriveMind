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

# In-memory history buffer (vehicle_id -> list of past 30 telemetry dicts)
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
    if len(VEHICLE_HISTORY[vehicle_id]) > 30:
        VEHICLE_HISTORY[vehicle_id].pop(0)
        
    history = VEHICLE_HISTORY[vehicle_id]
    n = len(history)
    
    # Backfill lags with current values if not enough history exists
    speed_lag_15 = history[max(0, n - 16)]["speed"]
    speed_lag_30 = history[max(0, n - 31)]["speed"]
    
    steering_lag_15 = history[max(0, n - 16)]["steeringAngle"]
    steering_lag_30 = history[max(0, n - 31)]["steeringAngle"]
    
    accel_lag_15 = history[max(0, n - 16)]["acceleration"]
    lane_offset_lag_15 = history[max(0, n - 16)]["laneOffset"]
    
    # Compute rolling statistics
    speeds = [f["speed"] for f in history]
    steerings = [f["steeringAngle"] for f in history]
    accels = [f["acceleration"] for f in history]
    
    # Window 15
    speeds_15 = speeds[-15:]
    steerings_15 = steerings[-15:]
    accels_15 = accels[-15:]
    
    speed_mean_15 = float(np.mean(speeds_15))
    speed_std_15 = float(np.std(speeds_15)) if len(speeds_15) > 1 else 0.0
    
    steering_mean_15 = float(np.mean(steerings_15))
    steering_std_15 = float(np.std(steerings_15)) if len(steerings_15) > 1 else 0.0
    
    accel_mean_15 = float(np.mean(accels_15))
    accel_std_15 = float(np.std(accels_15)) if len(accels_15) > 1 else 0.0
    
    # Window 30
    speed_mean_30 = float(np.mean(speeds))
    speed_std_30 = float(np.std(speeds)) if len(speeds) > 1 else 0.0
    
    steering_mean_30 = float(np.mean(steerings))
    steering_std_30 = float(np.std(steerings)) if len(steerings) > 1 else 0.0
    
    accel_mean_30 = float(np.mean(accels))
    accel_std_30 = float(np.std(accels)) if len(accels) > 1 else 0.0
    
    # Create DataFrame with all 24 features needed by the model
    features_df = pd.DataFrame([{
        "speed": data.speed,
        "acceleration": data.acceleration,
        "brakePressure": data.brakePressure,
        "steeringAngle": data.steeringAngle,
        "laneOffset": data.laneOffset,
        "distanceToFrontVehicle": data.distanceToFrontVehicle,
        "speed_lag_15": speed_lag_15,
        "speed_lag_30": speed_lag_30,
        "steering_lag_15": steering_lag_15,
        "steering_lag_30": steering_lag_30,
        "accel_lag_15": accel_lag_15,
        "lane_offset_lag_15": lane_offset_lag_15,
        "speed_mean_15": speed_mean_15,
        "speed_std_15": speed_std_15,
        "speed_mean_30": speed_mean_30,
        "speed_std_30": speed_std_30,
        "steering_mean_15": steering_mean_15,
        "steering_std_15": steering_std_15,
        "steering_mean_30": steering_mean_30,
        "steering_std_30": steering_std_30,
        "accel_mean_15": accel_mean_15,
        "accel_std_15": accel_std_15,
        "accel_mean_30": accel_mean_30,
        "accel_std_30": accel_std_30
    }])

    prediction = model.predict(features_df)[0]
    probabilities = model.predict_proba(features_df)[0]
    confidence = float(max(probabilities))

    return {
        "success": True,
        "predictedIntent": prediction,
        "confidence": round(confidence, 2)
    }