const formatTime = (time) => {
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

const sendMessage = (message) => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.error("WebSocket bağlantısı kapalı, mesaj gönderilemedi:", message);
  }
};

const sendSettings = () => {
  sendMessage({
    videoPath,
    algorithm: selectedAlgorithm,
    edgeDetection: elements.edgeDetectionCheckbox.checked,
    motionCompensation: elements.motionCompensationCheckbox.checked,
    colorEnhancement: elements.colorEnhancementCheckbox.checked,
    deepLearningEnhancement: elements.deepLearningEnhancementCheckbox.checked
  });
};

const elements = {
  canvas: document.getElementById("manipulated-canvas"),
  video: document.getElementById("hidden-video"),
  playPauseButton: document.getElementById("play-pause"),
  stopButton: document.getElementById("stop"),
  fullscreenButton: document.getElementById("fullscreen"),
  algorithmSelector: document.getElementById("algorithm-selector"),
  timeRange: document.getElementById("time-range"),
  edgeDetectionCheckbox: document.getElementById("edge-detection"),
  motionCompensationCheckbox: document.getElementById("motion-compensation"),
  colorEnhancementCheckbox: document.getElementById("color-enhancement"),
  deepLearningEnhancementCheckbox: document.getElementById("deep-learning-enhancement"),
  controls: document.getElementById("controls"),
  currentTime: document.getElementById("current-time"),
  totalTime: document.getElementById("total-time")
};

let isSeeking = false;
let hideControlsTimeout;

const updateTimeRange = () => {
  if (!isNaN(elements.video.duration)) {
    elements.timeRange.max = elements.video.duration;
    elements.totalTime.textContent = formatTime(elements.video.duration);
  }
};

const syncTimeUpdate = () => {
  if (!isSeeking) {
    elements.timeRange.value = elements.video.currentTime;
    elements.currentTime.textContent = formatTime(elements.video.currentTime);
  }
};

const handleVideoEnd = () => {
  elements.playPauseButton.innerHTML = getPlayIcon();
  elements.timeRange.value = 0;
};

const togglePlayPause = () => {
  if (isPlaying()) {
    elements.playPauseButton.innerHTML = getPauseIcon();
    sendMessage({ action: "play" });
    elements.video.play();
  } else {
    elements.playPauseButton.innerHTML = getPlayIcon();
    sendMessage({ action: "pause" });
    elements.video.pause();
  }
};

const seekTimeUpdate = () => {
  isSeeking = true;
  const newTime = parseFloat(elements.timeRange.value);
  elements.currentTime.textContent = formatTime(newTime);
  sendMessage({ action: "seek", time: newTime });
  elements.video.currentTime = newTime;
};

const stopVideo = () => {
  elements.playPauseButton.innerHTML = getPlayIcon();
  elements.timeRange.value = 0;
  sendMessage({ action: "pause" });
  sendMessage({ action: "seek", time: 0 });
  elements.video.pause();
  elements.video.currentTime = 0;
};

const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    elements.canvas.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
};

const showControls = () => {
  elements.controls.style.opacity = 1;
  clearTimeout(hideControlsTimeout);
  hideControlsTimeout = setTimeout(hideControls, 3000);
};

const hideControls = () => {
  elements.controls.style.opacity = 0;
};

const periodicSync = () => {
  const sliderTime = parseFloat(elements.timeRange.value);
  const videoTime = elements.video.currentTime;
  const drift = Math.abs(videoTime - sliderTime);
  if (drift > 0.3) {
    console.log(`Senkranizasyon: video.currentTime ${videoTime} iken, ayarlanan ${sliderTime}. Düzeltme yapılıyor.`);
    elements.video.currentTime = sliderTime;
  }
};

const getPlayIcon = () => `
  <svg viewBox="0 0 24 24">
    <path fill="currentColor" d="M8,5.14V19.14L19,12.14L8,5.14Z"/>
  </svg>`;

const getPauseIcon = () => `
  <svg viewBox="0 0 24 24">
    <path fill="currentColor" d="M6,19H8V5H6M16,19H18V5H16V19Z"/>
  </svg>`;

const isPlaying = () => elements.playPauseButton.innerHTML.includes("M8,5.14V19.14L19,12.14L8,5.14Z");

elements.video.addEventListener("loadedmetadata", updateTimeRange);
elements.video.addEventListener("timeupdate", syncTimeUpdate);
elements.algorithmSelector.addEventListener("change", sendSettings);
elements.edgeDetectionCheckbox.addEventListener("change", sendSettings);
elements.motionCompensationCheckbox.addEventListener("change", sendSettings);
elements.colorEnhancementCheckbox.addEventListener("change", sendSettings);
elements.deepLearningEnhancementCheckbox.addEventListener("change", sendSettings);
elements.playPauseButton.addEventListener("click", togglePlayPause);
elements.timeRange.addEventListener("input", seekTimeUpdate);
elements.timeRange.addEventListener("change", () => { isSeeking = false; });
elements.stopButton.addEventListener("click", stopVideo);
elements.fullscreenButton.addEventListener("click", toggleFullscreen);
elements.canvas.addEventListener("mousemove", showControls);
elements.controls.addEventListener("mousemove", showControls);

setInterval(periodicSync, 500);

showControls();

module.exports = {
  formatTime,
  sendMessage,
  sendSettings,
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
};