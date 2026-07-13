import io
import os
from datetime import datetime

import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, UploadFile
from fastapi.responses import Response
from PIL import Image
from prometheus_client import Counter, generate_latest, CONTENT_TYPE_LATEST
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

app = FastAPI()

# --- Model setup ---
session = ort.InferenceSession("model/best.onnx", providers=["CPUExecutionProvider"])
CLASS_NAMES = ["person", "ear", "ear-mufs", "face", "face-guard", "face-mask-medical",
               "foot", "tools", "glasses", "gloves", "helmet", "hands", "head",
               "medical-suit", "safety-suit", "safety-vest", "shoes"]

# --- Database setup ---
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local_dev.db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()

class Detection(Base):
    __tablename__ = "detections"
    id = Column(Integer, primary_key=True, index=True)
    class_name = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# --- Prometheus metrics ---
REQUEST_COUNT = Counter("ppe_requests_total", "Total number of /predict requests")
DETECTION_COUNT = Counter("ppe_detections_total", "Total number of PPE detections", ["class_name"])


def preprocess(image: Image.Image, size=640):
    image = image.convert("RGB").resize((size, size))
    arr = np.array(image).astype(np.float32) / 255.0
    arr = arr.transpose(2, 0, 1)[None, :, :, :]
    return arr


def postprocess(output, conf_threshold=0.25):
    preds = output[0][0]
    detections = []
    for pred in preds.T:
        scores = pred[4:]
        class_id = int(np.argmax(scores))
        confidence = float(scores[class_id])
        if confidence >= conf_threshold:
            detections.append({"class": CLASS_NAMES[class_id], "confidence": round(confidence, 3)})
    return detections


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
async def predict(file: UploadFile):
    REQUEST_COUNT.inc()
    image = Image.open(io.BytesIO(await file.read()))
    input_tensor = preprocess(image)
    outputs = session.run(None, {session.get_inputs()[0].name: input_tensor})
    detections = postprocess(outputs)

    db = SessionLocal()
    try:
        for det in detections:
            DETECTION_COUNT.labels(class_name=det["class"]).inc()
            db.add(Detection(class_name=det["class"], confidence=det["confidence"]))
        db.commit()
    finally:
        db.close()

    return {"detections": detections}


@app.get("/detections/history")
def detection_history(limit: int = 20):
    db = SessionLocal()
    try:
        rows = db.query(Detection).order_by(Detection.timestamp.desc()).limit(limit).all()
        return [
            {"class": r.class_name, "confidence": r.confidence, "timestamp": r.timestamp.isoformat()}
            for r in rows
        ]
    finally:
        db.close()


@app.get("/metrics")
def metrics():
    return Response(generate_latest(), media_type=CONTENT_TYPE_LATEST)