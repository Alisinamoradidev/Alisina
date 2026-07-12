const tfCore = require('@tensorflow/tfjs-core');
require('@tensorflow/tfjs-backend-cpu');
const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
const { Jimp } = require('jimp');
const path = require('path');

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;
  const modelPath = path.join(__dirname, 'models');
  await tfCore.setBackend('cpu');
  await tfCore.ready();
  await faceapi.nets.tinyFaceDetector.loadFromDisk(modelPath);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
  modelsLoaded = true;
}

async function decodeBase64Image(data) {
  if (data.includes(',')) data = data.split(',')[1];
  const buf = Buffer.from(data, 'base64');
  const image = await Jimp.read(buf);
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  const raw = image.bitmap.data;
  const rgb = new Float32Array(w * h * 3);
  for (let i = 0, j = 0; i < raw.length; i += 4, j += 3) {
    rgb[j] = raw[i];
    rgb[j + 1] = raw[i + 1];
    rgb[j + 2] = raw[i + 2];
  }
  return tfCore.tensor4d(rgb, [1, h, w, 3]);
}

const DETECT_OPTS = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });

async function processImage(base64) {
  await loadModels();
  const tensor = await decodeBase64Image(base64);
  const detections = await faceapi.detectAllFaces(tensor, DETECT_OPTS)
    .withFaceLandmarks()
    .withFaceDescriptors();
  tensor.dispose();

  if (detections.length === 0) throw new Error('No face detected in the image');
  if (detections.length > 1) throw new Error('Multiple faces detected. Please ensure only your face is visible.');

  const det = detections[0];
  const score = det.detection.score;
  if (score < 0.5) throw new Error(`Face quality too low (score: ${score.toFixed(3)}). Ensure your face is clearly visible and well-lit.`);

  const embedding = Array.from(det.descriptor);
  return { embedding, det_score: score, faces_detected: 1 };
}

async function verifyImage(base64, storedEmbeddings) {
  await loadModels();
  if (!storedEmbeddings || storedEmbeddings.length === 0) throw new Error('No stored embeddings provided');

  const tensor = await decodeBase64Image(base64);
  const detections = await faceapi.detectAllFaces(tensor, DETECT_OPTS)
    .withFaceLandmarks()
    .withFaceDescriptors();
  tensor.dispose();

  if (detections.length === 0) throw new Error('No face detected');
  if (detections.length > 1) throw new Error('Multiple faces detected');

  const det = detections[0];
  const score = det.detection.score;
  if (score < 0.5) throw new Error(`Face quality too low (score: ${score.toFixed(3)}). Make sure your face is clearly visible.`);

  const newEmb = det.descriptor;
  let bestDistance = Infinity;
  let bestIndex = -1;

  for (let i = 0; i < storedEmbeddings.length; i++) {
    const stored = new Float32Array(storedEmbeddings[i]);
    const dist = faceapi.euclideanDistance(newEmb, stored);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestIndex = i;
    }
  }

  const matched = bestDistance < 0.4;
  return { match: matched, distance: bestDistance, best_index: bestIndex, det_score: score };
}

module.exports = { processImage, verifyImage, loadModels };
