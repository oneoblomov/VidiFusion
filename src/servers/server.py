import cv2
import base64
import asyncio
import websockets
import json
import time
import torch
from torchvision import transforms
from PIL import Image
import numpy as np

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

models = {
    "edsr": None,
    "fsrcnn": None,
    "lapsrn": None,
    "esrgan": None,
    "swinir": None
}

def super_resolution(frame, model):
    if model is None:
        return frame
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1.0, (w, h), (0, 0, 0), swapRB=False, crop=False)
    model.setInput(blob)
    output = model.forward()
    output_frame = output.squeeze().transpose(1, 2, 0)
    output_frame = cv2.resize(output_frame, (w, h))
    return np.clip(output_frame, 0, 255).astype(np.uint8)

def motion_compensation(prev_frame, current_frame):
    if prev_frame is None:
        return current_frame
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    h, w = flow.shape[:2]
    map_x, map_y = np.meshgrid(np.arange(w), np.arange(h))
    flow_map = np.stack((map_x + flow[..., 0], map_y + flow[..., 1]), axis=-1)
    flow_map = flow_map.astype(np.float32)  # Ensure maps are float32 for cv2.remap
    return cv2.remap(current_frame, flow_map[...,0], flow_map[...,1], cv2.INTER_LINEAR)

def enhance_color(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2Lab)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((cl, a, b)), cv2.COLOR_Lab2BGR)

def deep_learning_enhancement(frame, model):
    if not model:
        return frame
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    frame_tensor = transforms.ToTensor()(Image.fromarray(frame_rgb)).unsqueeze(0).to(device)
    with torch.no_grad():
        enhanced_frame_tensor = model(frame_tensor)
    enhanced_frame = (enhanced_frame_tensor.squeeze().permute(1, 2, 0).cpu().numpy() * 255)\
                     .clip(0, 255).astype(np.uint8)
    return cv2.cvtColor(enhanced_frame, cv2.COLOR_RGB2BGR)

async def video_stream(websocket):
    cap = None
    try:
        message = await websocket.recv()
        data = json.loads(message)
        video_path = data["videoPath"]
        algorithm = data["algorithm"]
        edge_detection_enabled = data.get("edgeDetection", False)
        motion_compensation_enabled = data.get("motionCompensation", False)
        color_enhancement_enabled = data.get("colorEnhancement", False)
        deep_learning_enhancement_enabled = data.get("deepLearningEnhancement", False)

        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            raise RuntimeError(f"Could not open video: {video_path}")

        original_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        original_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        aspect_ratio = original_height / original_width
        target_width = 640
        target_height = int(target_width * aspect_ratio)
        fps = cap.get(cv2.CAP_PROP_FPS) or 30

        interpolation_methods = {
            "bilinear": cv2.INTER_LINEAR,
            "bicubic": cv2.INTER_CUBIC,
            "lanczos": cv2.INTER_LANCZOS4
        }

        paused = False
        prev_frame = None

        while True:
            start_time = time.time()
            
            if not paused:
                ret, frame = cap.read()
                if not ret:
                    await websocket.send(json.dumps({"status": "ended"}))
                    break

                if algorithm in interpolation_methods:
                    processed_frame = cv2.resize(frame, (target_width, target_height), interpolation=interpolation_methods[algorithm])
                elif algorithm in models:
                    processed_frame = super_resolution(frame, models[algorithm])
                else:
                    processed_frame = frame

                if motion_compensation_enabled:
                    processed_frame = motion_compensation(prev_frame, processed_frame)
                if edge_detection_enabled:
                    processed_frame = cv2.Canny(cv2.cvtColor(processed_frame, cv2.COLOR_BGR2GRAY), 100, 200)
                    processed_frame = cv2.cvtColor(processed_frame, cv2.COLOR_GRAY2BGR)
                if color_enhancement_enabled:
                    processed_frame = enhance_color(processed_frame)
                if deep_learning_enhancement_enabled:
                    processed_frame = deep_learning_enhancement(processed_frame, models["esrgan"])

                prev_frame = frame.copy()

                _, buffer = cv2.imencode('.jpg', processed_frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
                frame_base64 = base64.b64encode(buffer).decode()
                current_time = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0

                await websocket.send(json.dumps({"frame": frame_base64, "time": current_time}))

            try:
                timeout = max(0, (1 / fps) - (time.time() - start_time))
                control_message = await asyncio.wait_for(websocket.recv(), timeout=timeout)
                control_data = json.loads(control_message)
                
                if control_data["action"] == "pause":
                    paused = True
                elif control_data["action"] == "play":
                    paused = False
                elif control_data["action"] == "seek":
                    target_time = control_data["time"]
                    target_frame = int(target_time * fps)
                    cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
                    
            except asyncio.TimeoutError:
                pass

            elapsed = time.time() - start_time
            await asyncio.sleep(max(0, (1 / fps) - elapsed))

    except websockets.exceptions.ConnectionClosedOK:
        pass  
    except websockets.exceptions.ConnectionClosedError as e:
        print(f"Connection closed with error: {str(e)}")
    except Exception as e:
        print(f"Error: {str(e)}")
        await websocket.send(json.dumps({"error": str(e)}))
    finally:
        if cap:
            cap.release()
        await websocket.close()

async def main():
    async with websockets.serve(video_stream, "localhost", 8768):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())
