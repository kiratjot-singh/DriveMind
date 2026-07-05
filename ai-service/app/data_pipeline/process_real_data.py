import os
import glob
import pandas as pd
import numpy as np

def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000  # Earth radius in meters
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_phi = np.radians(lat2 - lat1)
    delta_lambda = np.radians(lon2 - lon1)
    
    a = np.sin(delta_phi / 2.0)**2 + np.cos(phi1) * np.cos(phi2) * np.sin(delta_lambda / 2.0)**2
    c = 2.0 * np.arctan2(np.sqrt(a), np.sqrt(1.0 - a))
    return R * c

def calculate_bearing(lat1, lon1, lat2, lon2):
    phi1 = np.radians(lat1)
    phi2 = np.radians(lat2)
    delta_lambda = np.radians(lon2 - lon1)
    
    y = np.sin(delta_lambda) * np.cos(phi2)
    x = np.cos(phi1) * np.sin(phi2) - np.sin(phi1) * np.cos(phi2) * np.cos(delta_lambda)
    bearing = np.degrees(np.arctan2(y, x))
    return (bearing + 360.0) % 360.0

def process_clip(df_clip):
    processed_records = []
    
    # Group by vehicle ID
    vehicle_groups = df_clip.groupby("id")
    
    # Store frame coordinates and headings of all vehicles for front distance calculation
    frame_lookup = {}
    vehicle_trajectories = {}
    
    for veh_id, group in vehicle_groups:
        group = group.sort_values("frame").copy()
        
        # Smooth coordinates using rolling average to eliminate GPS sensor noise
        lats = group["latitude"].rolling(window=15, min_periods=1, center=True).mean().values
        lons = group["longitude"].rolling(window=15, min_periods=1, center=True).mean().values
        frames = group["frame"].values
        
        n = len(group)
        if n < 5:
            continue
            
        speeds = np.zeros(n)
        accelerations = np.zeros(n)
        headings = np.zeros(n)
        steering_rates = np.zeros(n)
        
        speeds[0] = 0.0
        headings[0] = 0.0
        
        # Calculate speed
        for i in range(1, n):
            dt = (frames[i] - frames[i-1]) / 30.0
            if dt <= 0:
                dt = 1/30.0
            dist = haversine_distance(lats[i-1], lons[i-1], lats[i], lons[i])
            speeds[i] = np.clip((dist / dt) * 3.6, 0.0, 80.0)  # speed in km/h
            
        # Smooth speed to get cleaner accelerations
        speeds = pd.Series(speeds).rolling(window=15, min_periods=1, center=True).mean().values
        
        # Calculate acceleration and bearing/steering rates
        for i in range(1, n):
            dt = (frames[i] - frames[i-1]) / 30.0
            if dt <= 0:
                dt = 1/30.0
            
            raw_acc = ((speeds[i] - speeds[i-1]) / 3.6) / dt  # acceleration in m/s^2
            accelerations[i] = np.clip(raw_acc, -6.0, 4.0)
            
            headings[i] = calculate_bearing(lats[i-1], lons[i-1], lats[i], lons[i])
            
            dh = headings[i] - headings[i-1]
            dh = (dh + 180) % 360 - 180
            steering_rates[i] = dh / dt
            
        # Smooth steering rate to eliminate spikes
        steering_rates = pd.Series(steering_rates).rolling(window=15, min_periods=1, center=True).mean().values
        
        # Estimate lane offset using deviation from smoothed path (rolling average of 60 frames for road layout)
        smoothed_lats = pd.Series(lats).rolling(window=60, min_periods=1, center=True).mean().values
        smoothed_lons = pd.Series(lons).rolling(window=60, min_periods=1, center=True).mean().values
        
        lane_offsets = haversine_distance(lats, lons, smoothed_lats, smoothed_lons)
        for i in range(n):
            if i > 0:
                smooth_bearing = calculate_bearing(smoothed_lats[i-1], smoothed_lons[i-1], smoothed_lats[i], smoothed_lons[i])
                raw_bearing = calculate_bearing(smoothed_lats[i], smoothed_lons[i], lats[i], lons[i])
                diff_angle = (raw_bearing - smooth_bearing + 180) % 360 - 180
                if diff_angle < 0:
                    lane_offsets[i] = -lane_offsets[i]
                    
        # Compute rolling features over past windows (using pandas Series rolling)
        speeds_series = pd.Series(speeds)
        steering_series = pd.Series(steering_rates)
        accel_series = pd.Series(accelerations)
        
        # Rolling windows: 10, 15, 30, 45 frames
        speed_mean_10 = speeds_series.rolling(window=10, min_periods=1).mean().values
        speed_std_10 = speeds_series.rolling(window=10, min_periods=1).std().fillna(0.0).values
        speed_mean_15 = speeds_series.rolling(window=15, min_periods=1).mean().values
        speed_std_15 = speeds_series.rolling(window=15, min_periods=1).std().fillna(0.0).values
        speed_mean_30 = speeds_series.rolling(window=30, min_periods=1).mean().values
        speed_std_30 = speeds_series.rolling(window=30, min_periods=1).std().fillna(0.0).values
        speed_mean_45 = speeds_series.rolling(window=45, min_periods=1).mean().values
        speed_std_45 = speeds_series.rolling(window=45, min_periods=1).std().fillna(0.0).values
        
        steering_mean_10 = steering_series.rolling(window=10, min_periods=1).mean().values
        steering_std_10 = steering_series.rolling(window=10, min_periods=1).std().fillna(0.0).values
        steering_mean_15 = steering_series.rolling(window=15, min_periods=1).mean().values
        steering_std_15 = steering_series.rolling(window=15, min_periods=1).std().fillna(0.0).values
        steering_mean_30 = steering_series.rolling(window=30, min_periods=1).mean().values
        steering_std_30 = steering_series.rolling(window=30, min_periods=1).std().fillna(0.0).values
        steering_mean_45 = steering_series.rolling(window=45, min_periods=1).mean().values
        steering_std_45 = steering_series.rolling(window=45, min_periods=1).std().fillna(0.0).values
        
        accel_mean_10 = accel_series.rolling(window=10, min_periods=1).mean().values
        accel_std_10 = accel_series.rolling(window=10, min_periods=1).std().fillna(0.0).values
        accel_mean_15 = accel_series.rolling(window=15, min_periods=1).mean().values
        accel_std_15 = accel_series.rolling(window=15, min_periods=1).std().fillna(0.0).values
        accel_mean_30 = accel_series.rolling(window=30, min_periods=1).mean().values
        accel_std_30 = accel_series.rolling(window=30, min_periods=1).std().fillna(0.0).values
        accel_mean_45 = accel_series.rolling(window=45, min_periods=1).mean().values
        accel_std_45 = accel_series.rolling(window=45, min_periods=1).std().fillna(0.0).values
                    
        vehicle_trajectories[veh_id] = {
            "frames": frames, "lats": lats, "lons": lons,
            "speeds": speeds, "accelerations": accelerations,
            "headings": headings, "steering_rates": steering_rates, "lane_offsets": lane_offsets,
            "speed_mean_10": speed_mean_10, "speed_std_10": speed_std_10,
            "speed_mean_15": speed_mean_15, "speed_std_15": speed_std_15,
            "speed_mean_30": speed_mean_30, "speed_std_30": speed_std_30,
            "speed_mean_45": speed_mean_45, "speed_std_45": speed_std_45,
            "steering_mean_10": steering_mean_10, "steering_std_10": steering_std_10,
            "steering_mean_15": steering_mean_15, "steering_std_15": steering_std_15,
            "steering_mean_30": steering_mean_30, "steering_std_30": steering_std_30,
            "steering_mean_45": steering_mean_45, "steering_std_45": steering_std_45,
            "accel_mean_10": accel_mean_10, "accel_std_10": accel_std_10,
            "accel_mean_15": accel_mean_15, "accel_std_15": accel_std_15,
            "accel_mean_30": accel_mean_30, "accel_std_30": accel_std_30,
            "accel_mean_45": accel_mean_45, "accel_std_45": accel_std_45
        }
        
        # Populate frame lookup for distance to front vehicle
        for i in range(n):
            f = frames[i]
            if f not in frame_lookup:
                frame_lookup[f] = {}
            frame_lookup[f][veh_id] = (lats[i], lons[i], headings[i])
            
    # Compute relative features, sequence history lags, and future stable ground-truth labels
    for veh_id, traj in vehicle_trajectories.items():
        frames = traj["frames"]
        lats = traj["lats"]
        lons = traj["lons"]
        speeds = traj["speeds"]
        accelerations = traj["accelerations"]
        headings = traj["headings"]
        steering_rates = traj["steering_rates"]
        lane_offsets = traj["lane_offsets"]
        
        n = len(frames)
        look_ahead = 45  # 1.5 seconds at 30 FPS
        
        # Start at index 45 to ensure we have a valid dense history window
        for i in range(45, n - look_ahead):
            f = frames[i]
            dist_to_front = 100.0  # Default to 100 meters if no vehicle ahead
            lat_i, lon_i, head_i = lats[i], lons[i], headings[i]
            
            other_vehs = frame_lookup.get(f, {})
            min_dist = 100.0
            for other_id, (lat_j, lon_j, head_j) in other_vehs.items():
                if other_id == veh_id:
                    continue
                dist = haversine_distance(lat_i, lon_i, lat_j, lon_j)
                if dist < min_dist:
                    # check if other vehicle is in front (within 45 degrees cone)
                    bearing_to_j = calculate_bearing(lat_i, lon_i, lat_j, lon_j)
                    angle_diff = (bearing_to_j - head_i + 180) % 360 - 180
                    if abs(angle_diff) < 45:
                        min_dist = dist
            dist_to_front = min_dist
            
            speed = speeds[i]
            acc = accelerations[i]
            brake_pressure = min(1.0, max(0.0, -acc / 4.0)) if acc < 0 else 0.0
            steering_angle = steering_rates[i]
            lane_offset = lane_offsets[i]
            
            # Physical Interaction features
            speed_sq = speed ** 2
            speed_dist_ratio = speed / (dist_to_front + 1.0)
            steering_speed = steering_angle * speed
            abs_steering_speed = abs(steering_angle) * speed
            safe_margin = dist_to_front - (speed / 3.6 * 1.5)
            abs_steering = abs(steering_angle)
            accel_steering = acc * steering_angle
            
            # Pack core and physical interaction features
            rec = {
                "speed": round(speed, 2),
                "acceleration": round(acc, 2),
                "brakePressure": round(brake_pressure, 2),
                "steeringAngle": round(steering_angle, 2),
                "laneOffset": round(lane_offset, 2),
                "distanceToFrontVehicle": round(dist_to_front, 2),
                "speed_sq": round(speed_sq, 2),
                "speed_dist_ratio": round(speed_dist_ratio, 2),
                "steering_speed": round(steering_speed, 2),
                "abs_steering_speed": round(abs_steering_speed, 2),
                "safe_margin": round(safe_margin, 2),
                "abs_steering": round(abs_steering, 2),
                "accel_steering": round(accel_steering, 2)
            }
            
            # Dense history lag features: 5, 10, 15, 20, 25, 30, 45
            for lag in [5, 10, 15, 20, 25, 30, 45]:
                rec[f"speed_lag_{lag}"] = round(speeds[i-lag], 2)
                rec[f"steering_lag_{lag}"] = round(steering_rates[i-lag], 2)
                rec[f"accel_lag_{lag}"] = round(accelerations[i-lag], 2)
                rec[f"lane_offset_lag_{lag}"] = round(lane_offsets[i-lag], 2)
            
            # Multi-window rolling statistics features: 10, 15, 30, 45
            for win in [10, 15, 30, 45]:
                rec[f"speed_mean_{win}"] = round(traj[f"speed_mean_{win}"][i], 2)
                rec[f"speed_std_{win}"] = round(traj[f"speed_std_{win}"][i], 2)
                rec[f"steering_mean_{win}"] = round(traj[f"steering_mean_{win}"][i], 2)
                rec[f"steering_std_{win}"] = round(traj[f"steering_std_{win}"][i], 2)
                rec[f"accel_mean_{win}"] = round(traj[f"accel_mean_{win}"][i], 2)
                rec[f"accel_std_{win}"] = round(traj[f"accel_std_{win}"][i], 2)
            
            # Future window metrics for labeling using mean endpoint window to eliminate noise
            future_speeds = speeds[i:i+look_ahead]
            future_headings = headings[i:i+look_ahead]
            future_lane_offsets = lane_offsets[i:i+look_ahead]
            
            future_speed_stable = np.mean(future_speeds[-15:])
            future_heading_stable = np.mean(future_headings[-15:])
            
            speed_change = future_speed_stable - speed
            heading_change = (future_heading_stable - head_i + 180) % 360 - 180
            max_future_offset = np.max(np.abs(future_lane_offsets))
            
            # Assign ground truth intent based on future stable behavior
            intent = "normal"
            if speed_change < -5.0:
                intent = "brake"
            elif heading_change > 15.0:
                intent = "turn_right"
            elif heading_change < -15.0:
                intent = "turn_left"
            elif abs(max_future_offset) > 1.5 and abs(heading_change) < 10.0:
                intent = "lane_change"
            elif speed_change > 5.0:
                intent = "accelerate"
                
            rec["intent"] = intent
            processed_records.append(rec)
            
    return pd.DataFrame(processed_records)

def main():
    raw_dir = "/Users/raghavbhardwaj/DriveMind/ai-service/data/raw/isee_you/Results"
    output_path = "/Users/raghavbhardwaj/DriveMind/ai-service/data/real_intent_training_data.csv"
    
    veh_files = [
        os.path.join(raw_dir, "1_04_13_00_veh.csv"),
        os.path.join(raw_dir, "1_06_37_00_veh.csv")
    ]
    
    all_processed = []
    
    for file_path in veh_files:
        if os.path.exists(file_path):
            print(f"Processing raw trajectory file: {file_path}")
            df = pd.read_csv(file_path)
            processed_df = process_clip(df)
            print(f"Generated {len(processed_df)} samples from {os.path.basename(file_path)}")
            all_processed.append(processed_df)
        else:
            print(f"Warning: File not found {file_path}")
            
    if not all_processed:
        print("Error: No raw trajectory files processed.")
        return
        
    combined_df = pd.concat(all_processed, ignore_index=True)
    
    # Save the processed dataset
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    combined_df.to_csv(output_path, index=False)
    print(f"\nSaved combined processed dataset to: {output_path}")
    print(f"Total dataset shape: {combined_df.shape}")
    print("\nClass distribution in the real dataset:")
    print(combined_df["intent"].value_counts())

if __name__ == "__main__":
    main()
