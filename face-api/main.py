import gc
import io
import os
import base64
import logging
import numpy as np
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="InsightFace Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://alisina-nu.vercel.app"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

face_app = None


def get_face_app():
    global face_app
    if face_app is None:
        logger.info("Loading InsightFace modules...")
        import cv2
        from insightface.app import FaceAnalysis
        logger.info("Initializing InsightFace (buffalo_s)...")
        face_app = FaceAnalysis(
            name="buffalo_s",
            providers=["CPUExecutionProvider"],
        )
        face_app.prepare(ctx_id=0, det_size=(640, 640))
        logger.info("InsightFace initialized.")
    return face_app


LIVENESS_THRESHOLD = 0.5
SIMILARITY_THRESHOLD = 0.4


def decode_image(data: str):
    from PIL import Image
    if "," in data:
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    img = Image.open(io.BytesIO(raw)).convert("RGB")
    arr = np.array(img)[:, :, ::-1].copy()
    img.close()
    return arr


class ProcessRequest(BaseModel):
    image: str


class VerifyRequest(BaseModel):
    image: str
    stored_embeddings: list[list[float]]


FACE_API_SECRET = os.environ.get("FACE_API_SECRET", "")


async def verify_api_key(authorization: Optional[str] = Header(None)):
    if not FACE_API_SECRET:
        raise HTTPException(status_code=500, detail="FACE_API_SECRET not configured")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization.split(" ", 1)[1]
    if not _secure_compare(token, FACE_API_SECRET):
        raise HTTPException(status_code=401, detail="Invalid API key")


def _secure_compare(a: str, b: str) -> bool:
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


@app.post("/api/face/process")
async def process_face(req: ProcessRequest, _auth: None = Depends(verify_api_key)):
    try:
        img = decode_image(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    app_face = get_face_app()
    faces = app_face.get(img)
    del img
    gc.collect()

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
async def verify_face(req: VerifyRequest, _auth: None = Depends(verify_api_key)):
    try:
        img = decode_image(req.image)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")

    if not req.stored_embeddings or len(req.stored_embeddings) == 0:
        raise HTTPException(status_code=400, detail="No stored embeddings provided")

    app_face = get_face_app()
    faces = app_face.get(img)
    del img
    gc.collect()

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
    gc.collect()

    return {
        "match": matched,
        "distance": round(best_distance, 6),
        "best_index": best_index,
        "det_score": det_score,
    }


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "buffalo_s"}
