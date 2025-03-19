const { ipcRenderer } = require("electron");
const {
  handleVideoEnd,
  togglePlayPause,
  stopVideo,
  toggleFullscreen,
  showControls,
  hideControls,
  periodicSync,
  updateTimeRange,
  syncTimeUpdate,
  seekTimeUpdate
} = require("./videoController");

const elements = {
  canvas: document.getElementById("manipulated-canvas"),
  video: document.getElementById("hidden-video"),
  algorithmSelector: document.getElementById("algorithm-selector"),
  edgeDetectionCheckbox: document.getElementById("edge-detection"),
  motionCompensationCheckbox: document.getElementById("motion-compensation"),
  colorEnhancementCheckbox: document.getElementById("color-enhancement"),
  deepLearningEnhancementCheckbox: document.getElementById("deep-learning-enhancement")
};

const ctx = elements.canvas.getContext("2d");
let socket = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;

const urlParams = new URLSearchParams(window.location.search);
const videoPath = decodeURIComponent(urlParams.get("video"));
if (videoPath) elements.video.src = videoPath;

const sendMessage = (message) => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.error("WebSocket connection is closed, message not sent:", message);
  }
};

const sendSettings = () => {
  sendMessage({
    videoPath,
    algorithm: elements.algorithmSelector.value,
    edgeDetection: elements.edgeDetectionCheckbox.checked,
    motionCompensation: elements.motionCompensationCheckbox.checked,
    colorEnhancement: elements.colorEnhancementCheckbox.checked,
    deepLearningEnhancement: elements.deepLearningEnhancementCheckbox.checked
  });
};

const startWebSocket = () => {
  socket?.close();
  socket = new WebSocket("ws://localhost:8768");

  socket.onopen = () => {
    console.log("New connection opened");
    reconnectAttempts = 0;
    sendSettings();
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.status === "ended") {
      handleVideoEnd();
      return;
    }
    if (data.frame) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
        ctx.drawImage(img, 0, 0, elements.canvas.width, elements.canvas.height);
      };
      img.src = `data:image/jpeg;base64,${data.frame}`;
    } else {
      console.error("Received frame data is undefined:", data);
    }
  };

  socket.onclose = () => {
    console.log("Connection closed");
    if (reconnectAttempts < maxReconnectAttempts) {
      const delay = Math.pow(2, reconnectAttempts) * 1000;
      console.log(`Reconnecting in ${delay / 1000} seconds...`);
      reconnectAttempts++;
      setTimeout(startWebSocket, delay);
    } else {
      console.error("Maximum reconnect attempts exceeded.");
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };
};

const addEventListeners = () => {
  elements.algorithmSelector.addEventListener("change", sendSettings);
  elements.edgeDetectionCheckbox.addEventListener("change", sendSettings);
  elements.motionCompensationCheckbox.addEventListener("change", sendSettings);
  elements.colorEnhancementCheckbox.addEventListener("change", sendSettings);
  elements.deepLearningEnhancementCheckbox.addEventListener("change", sendSettings);
};

addEventListeners();
setInterval(periodicSync, 500);
startWebSocket();
showControls();