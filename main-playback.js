const { app, BrowserWindow } = require('electron');
const path = require('path');

function createPlaybackWindow(videoPath) {
  const playbackWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minHeight: 400,
    minWidth: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,      
    }
  });

  playbackWindow.loadURL(`file://${__dirname}/src/playback.html?video=${encodeURIComponent(videoPath)}`);
}

app.whenReady().then(() => {
  const videoPath = process.argv[2]; // Video path as a command line argument
  if (videoPath) {
    createPlaybackWindow(videoPath);
  } else {
    console.error('No video path provided');
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const videoPath = process.argv[2];
    if (videoPath) {
      createPlaybackWindow(videoPath);
    }
  }
});