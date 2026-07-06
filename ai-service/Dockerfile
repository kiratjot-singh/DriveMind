FROM python:3.12-slim

WORKDIR /app

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run model generation and training if model file does not exist, then start uvicorn
CMD ["sh", "-c", "if [ ! -f models/intent_model.joblib ]; then python app/data_pipeline/process_real_data.py && python app/train_model.py; fi && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
