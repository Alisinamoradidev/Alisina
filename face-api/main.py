import io
import os
import base64
import logging
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image

import cv2
import insightface
from insightface.app import FaceAnalysis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="InsightFace Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

face_app = None


def get_face_app():
    global face_app
    if face_app is None:
        logger.info("Initializing InsightFace (buffalo_l)...")
        face_app = FaceAnalysis(
            name="buffalo_l",
            providers=["CPUExecutionProvider"],
        )
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace initialized.")
    return face_app


LIVENESS_THRESHOLD = 0.5
SIMILARITY_THRESHOLD = 0.4


def decode_image(data: str) -> np.ndarray:
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    return np.array(img)[:, :, ::-1].copy()


class ProcessRequest(BaseModel):
    image: str


class VerifyRequest(BaseModel):
    image: str
    stored_embeddings: list[list[float]]


@app.on_event("startup")
async def startup():
    get_face_app()


@app.post("/api/face/process")
async def process_face(req: ProcessRequest):
    try:
        img = decode_image(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    app_face = get_face_app()
    faces = app_face.get(img)

    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected in the image")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected. Please ensure only your face is visible.")

    face = faces[0]
    det_score = float(face.det_score)

    if det_score < LIVENESS_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Face quality too low (score: {det_score:.3f}). Ensure your face is clearly visible and well-lit.",
        )

    embedding = face.embedding.tolist()
    return {
        "embedding": embedding,
        "det_score": det_score,
        "faces_detected": 1,
    }


@app.post("/api/face/verify")
async def verify_face(req: VerifyRequest):
    try:
        img = decode_image(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    if not req.stored_embeddings or len(req.stored_embeddings) == 0:
        raise HTTPException(status_code=400, detail="No stored embeddings provided")

    app_face = get_face_app()
    faces = app_face.get(img)

    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="No face detected")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Multiple faces detected")

    face = faces[0]
    det_score = float(face.det_score)

    if det_score < LIVENESS_THRESHOLD:
        raise HTTPException(
            status_code=400,
            detail=f"Face quality too low (score: {det_score:.3f}). Make sure your face is clearly visible.",
        )

    new_emb = face.embedding
    best_distance = float("inf")
    best_index = -1

    for i, stored in enumerate(req.stored_embeddings):
        stored_arr = np.array(stored, dtype=np.float32)
        cos_sim = np.dot(new_emb, stored_arr) / (
            np.linalg.norm(new_emb) * np.linalg.norm(stored_arr) + 1e-8
        )
        distance = 1.0 - float(cos_sim)
        if distance < best_distance:
            best_distance = distance
            best_index = i

    matched = best_distance < SIMILARITY_THRESHOLD

    return {
        "match": matched,
        "distance": round(best_distance, 6),
        "best_index": best_index,
        "det_score": det_score,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "buffalo_l"}
