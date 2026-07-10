import io
import os
import base64
import json
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import face_recognition
from PIL import Image

app = FastAPI(title="Face Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CompareRequest(BaseModel):
    descriptor: list

@app.post("/api/face/process")
async def process_face(file: UploadFile = File(...)):
    contents = await file.read()
    img = face_recognition.load_image_file(io.BytesIO(contents))
    face_locations = face_recognition.face_locations(img)
    if len(face_locations) == 0:
        raise HTTPException(status_code=400, detail="No face detected")
    encodings = face_recognition.face_encodings(img, face_locations)
    if len(encodings) == 0:
        raise HTTPException(status_code=400, detail="Could not compute face encoding")
    return {"encoding": encodings[0].tolist(), "faces": len(face_locations)}

@app.post("/api/face/verify")
async def verify_face(file: UploadFile = File(...), stored: str = ""):
    contents = await file.read()
    img = face_recognition.load_image_file(io.BytesIO(contents))
    face_locations = face_recognition.face_locations(img)
    if len(face_locations) == 0:
        raise HTTPException(status_code=400, detail="No face detected")
    encodings = face_recognition.face_encodings(img, face_locations)
    if len(encodings) == 0:
        raise HTTPException(status_code=400, detail="Could not compute face encoding")
    try:
        stored_encoding = np.array(json.loads(stored))
    except:
        raise HTTPException(status_code=400, detail="Invalid stored encoding")
    matches = face_recognition.compare_faces([stored_encoding], encodings[0])
    distance = face_recognition.face_distance([stored_encoding], encodings[0])[0]
    return {"match": bool(matches[0]), "distance": float(distance)}

@app.get("/api/health")
async def health():
    return {"status": "ok"}
