# DriveMind Intent Prediction Model

## 1. Purpose

The intent prediction model predicts the future behavior of a vehicle using telemetry data.

It predicts one of the following intents:

- brake
- accelerate
- turn_left
- turn_right
- lane_change
- normal

---

## 2. Current Dataset

The model is trained on a real-world vehicle trajectory dataset (the `I See You` dataset), which contains real vehicle trajectories recorded by traffic surveillance cameras at signalized intersections.

The raw coordinates are preprocessed using:

```text
ai-service/app/data_pipeline/process_real_data.py
```

Generated features:

- speed
- acceleration
- brakePressure
- steeringAngle
- laneOffset
- distanceToFrontVehicle

Target label:

```text
intent
```

---

## 3. Important Note About Data

The model has been successfully upgraded from synthetic rule-based validation data to use a real-world trajectory-derived dataset. 

It maps actual vehicle dynamics features (like coordinates, relative spacings, and yaw rates) to **real future-trajectory intents** (observed by looking 1.5 seconds ahead in the actual vehicle's trajectory). This is a robust machine learning setup that maps current telemetry to real future driver actions.

---

## 4. Model Used

Current model:

```text
Random Forest Classifier
```

Reason:

- works well on tabular telemetry data
- fast to train
- easy to explain
- good baseline model for MVP
- supports probability-based confidence score

---

## 5. Model Input

Example input:

```json
{
  "speed": 72,
  "acceleration": -1.6,
  "brakePressure": 0.82,
  "steeringAngle": 22,
  "laneOffset": 0.41,
  "distanceToFrontVehicle": 7
}
```

---

## 6. Model Output

Example output:

```json
{
  "success": true,
  "predictedIntent": "brake",
  "confidence": 0.97
}
```

---

## 7. Current Evaluation Result

The model achieved:

```text
Accuracy: 90.84%
Macro F1-score: 0.83
Weighted F1-score: 0.91
```

This score is realistic for real-world driving data where future maneuvers are predicted from current telemetry profiles. The model successfully generalizes driver intentions from raw telemetry.

---

## 8. Data Upgrade Status

Data upgrade status:

```text
Synthetic data (MVP Stage - Completed)
    ↓
Real-world trajectory-derived features (Current Stage - Completed)
```

The model has been successfully upgraded to run on real trajectory telemetry data. Future versions may integrate simulator telemetry (e.g. CARLA) for expanded scenario coverage.

---

## 9. AI Service Endpoint

The FastAPI service exposes:

```http
POST /predict-intent
```

Full local URL:

```text
http://127.0.0.1:8000/predict-intent
```

---

## 10. Backend Integration

The Node.js backend calls the AI service during telemetry ingestion.

Flow:

```text
Vehicle sends telemetry
        ↓
Backend receives telemetry
        ↓
Backend sends telemetry to AI service
        ↓
AI returns predicted intent
        ↓
Backend calculates risk
        ↓
Backend stores experience memory if risk is high
```