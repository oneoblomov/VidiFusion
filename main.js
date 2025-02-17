const { app, BrowserWindow, ipcMain, systemPreferences, Menu, dialog } = require('electron'); 
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const username = os.userInfo().username;
const platform = os.platform();

function createMenu(mainWindow) { 
  const template = [
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Back',
          click: () => mainWindow.webContents.goBack(),
        },
        {
          label: 'Forward',
          click: () => mainWindow.webContents.goForward(),
        },
      ],
    },
    {
      label: 'Video',
      submenu: [
        {
          label: 'Video Aç',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'VidiFusion', extensions: ['mp4', 'avi', 'mkv'] }
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const videoPath = result.filePaths[0];
              exec(`npm run start-playback -- "${encodeURIComponent(videoPath)}"`);
            }
          }
        },
        {
          label: 'İnternet Videosu Aç',
          click: () => {
            const urlWindow = new BrowserWindow({
              width: 400,
              height: 200,
              parent: mainWindow,
              modal: true,
              webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
              }
            });
            urlWindow.loadFile('src/url_input.html');
          }
        }
      ]
    },
    {
      label: 'Developer',
      submenu: [
        {
          label: 'Debug Mode',
          type: 'checkbox',
          checked: false,
          accelerator: 'CmdOrCtrl+Shift+D',
          click: (item) => {
            mainWindow.webContents.send('toggle-debug', item.checked);
            mainWindow.webContents.toggleDevTools();
          }
        },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.reload()
        }
      ]
    }
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    minWidth: 800,
    minHeight: 400,
    width: 1200,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,       
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');
  createMenu(mainWindow); 
}

ipcMain.on('open-playback-window', (event, videoPath) => {
  exec(`npm run start-playback -- "${encodeURIComponent(videoPath)}"`);
});

ipcMain.on('open-url', (event, url) => {
  const videoWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });
  videoWindow.loadURL(`file://${__dirname}/src/playback.html?video=${encodeURIComponent(url)}`);
  createMenu(videoWindow); 
});

app.whenReady().then(createWindow);

ipcMain.handle('get-videos', async () => {
  const videoExtensions = new Set(['.mp4', '.avi', '.mkv']);
  const videoPaths = {};

  async function findVideos(dir) {
    let files;
    try {
      await fs.access(dir, fs.constants.R_OK | fs.constants.X_OK);
      files = await fs.readdir(dir);
    } catch (err) {
      console.error(`Error accessing ${dir}: ${err.message}`);
      return;
    }

    await Promise.all(files.map(async (file) => {
      const fullPath = path.join(dir, file);
      try {
        const stat = await fs.lstat(fullPath);
        if (stat.isSymbolicLink()) {
          return;
        }
        if (stat.isDirectory()) {
          await findVideos(fullPath);
        } else if (videoExtensions.has(path.extname(fullPath).toLowerCase())) {
          const parentDir = path.basename(dir);
          if (!videoPaths[parentDir]) {
            videoPaths[parentDir] = [];
          }
          videoPaths[parentDir].push(fullPath);
        }
      } catch (err) {
        console.error(`Error accessing ${fullPath}: ${err.message}`);
      }
    }));
  }

  try {
    const directories = {
      win32: [path.join('C:', 'Users', username, 'Videos')],
      darwin: [path.join('/Users', username, 'Movies')],
      linux: [
        path.join('/home', username, 'Videos'),
        path.join('/home', username, 'dwhelper'),
        path.join('/home', username, 'Downloads'),
      ]
    }[platform] || [];

    await Promise.all(directories.map(findVideos));

    return videoPaths;
  } catch (err) {
    console.error('Video tarama sırasında hata oluştu:', err);
    return {};
  }
});

ipcMain.handle('get-accent-color', () => {
  return process.platform === 'darwin' 
    ? systemPreferences.getAccentColor() 
    : '#0078D4'; 
});

ipcMain.handle('get-theme-color', () => {
  return process.platform === 'darwin'
    ? systemPreferences.getColor('window')
    : '#FFFFFF';
});