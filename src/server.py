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

"""
edsr_model = cv2.dnn.readNetFromTensorflow("EDSR_x4.pb")
fsrcnn_model = cv2.dnn.readNetFromTensorflow("FSRCNN_x4.pb")
lapsrn_model = cv2.dnn.readNetFromTensorflow("LapSRN_x8.pb")
esrgan_model = torch.hub.load('AK391/ESRGAN', 'esrgan', pretrained=True)
swinir_model = torch.hub.load('JingyunLiang/SwinIR', 'swinir_sr_classical_patch48_x4', pretrained=True)
"""
def super_resolution(frame, model):
    h, w = frame.shape[:2]
    blob = cv2.dnn.blobFromImage(frame, 1.0, (w, h), (0, 0, 0), swapRB=True, crop=False)
    model.setInput(blob)
    output = model.forward()
    output_frame = output.squeeze().transpose(1, 2, 0)
    output_frame = cv2.resize(output_frame, (w, h))
    return np.clip(output_frame, 0, 255).astype(np.uint8)

def edge_detection(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 100, 200)
    return cv2.cvtColor(edges, cv2.COLOR_GRAY2BGR)

def motion_compensation(prev_frame, current_frame):
    if prev_frame is None:
        return current_frame
    prev_gray = cv2.cvtColor(prev_frame, cv2.COLOR_BGR2GRAY)
    curr_gray = cv2.cvtColor(current_frame, cv2.COLOR_BGR2GRAY)
    flow = cv2.calcOpticalFlowFarneback(prev_gray, curr_gray, None, 0.5, 3, 15, 3, 5, 1.2, 0)
    h, w = flow.shape[:2]
    map_x = np.tile(np.arange(w), (h, 1)).astype(np.float32)
    map_y = np.tile(np.arange(h), (w, 1)).T.astype(np.float32)
    flow_map = np.stack((map_x + flow[...,0], map_y + flow[...,1]), axis=-1)
    compensated_frame = cv2.remap(current_frame, flow_map, None, cv2.INTER_LINEAR)
    return compensated_frame

def enhance_color(frame):
    lab = cv2.cvtColor(frame, cv2.COLOR_BGR2Lab)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced_lab = cv2.merge((cl, a, b))
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_Lab2BGR)

def deep_learning_enhancement(frame):
    if 'esrgan_model' not in globals():
        return frame  
    frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    preprocess = transforms.Compose([
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])
    frame_tensor = preprocess(frame_pil).unsqueeze(0)
    with torch.no_grad():
        enhanced_frame_tensor = esrgan_model(frame_tensor)
    enhanced_frame = enhanced_frame_tensor.squeeze().permute(1, 2, 0).cpu().numpy()
    enhanced_frame = (enhanced_frame * 0.5 + 0.5) * 255
    # Convert the result from RGB to BGR so that later conversion gives the correct color
    enhanced_frame = cv2.cvtColor(enhanced_frame.clip(0, 255).astype(np.uint8), cv2.COLOR_RGB2BGR)
    return enhanced_frame

def swinir_super_resolution(frame):
    if 'swinir_model' not in globals():
        return frame  
    frame_pil = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    frame_tensor = transforms.ToTensor()(frame_pil).unsqueeze(0)
    with torch.no_grad():
        enhanced_frame_tensor = swinir_model(frame_tensor)
    enhanced_frame = enhanced_frame_tensor.squeeze().permute(1, 2, 0).cpu().numpy()
    enhanced_frame = (enhanced_frame * 255).clip(0, 255).astype(np.uint8)
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
        target_width = 640  # Define a default target width
        target_height = int(target_width * aspect_ratio)  # Doğru hesaplama

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30

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
                    processed_frame = cv2.resize(
                        frame, 
                        (target_width, target_height), 
                        interpolation=interpolation_methods[algorithm]
                    )
                elif algorithm == "edsr":
                    processed_frame = super_resolution(frame, edsr_model)
                elif algorithm == "fsrcnn":
                    processed_frame = super_resolution(frame, fsrcnn_model)
                elif algorithm == "lapsrn":
                    processed_frame = super_resolution(frame, lapsrn_model)
                elif algorithm == "swinir":
                    processed_frame = swinir_super_resolution(frame)
                else:
                    processed_frame = frame

                height, width = processed_frame.shape[:2]
                if width != target_width or height != target_height:
                    processed_frame = cv2.resize(processed_frame, (target_width, target_height))

                if motion_compensation_enabled:
                    processed_frame = motion_compensation(prev_frame, processed_frame)
                if edge_detection_enabled:
                    processed_frame = edge_detection(processed_frame)
                if color_enhancement_enabled:
                    processed_frame = enhance_color(processed_frame)
                if deep_learning_enhancement_enabled:
                    processed_frame = deep_learning_enhancement(processed_frame)

                prev_frame = frame.copy()

                processed_frame = cv2.cvtColor(processed_frame, cv2.COLOR_BGR2RGB)
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
                    fps_current = cap.get(cv2.CAP_PROP_FPS)
                    if fps_current <= 0:
                        fps_current = fps
                    target_frame = int(target_time * fps_current)
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
        print(f"Hata: {str(e)}")
        await websocket.send(json.dumps({"error": str(e)}))
    finally:
        if cap:
            cap.release()
        await websocket.close()

async def main():
    async with websockets.serve(video_stream, "localhost", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())