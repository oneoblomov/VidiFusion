const { app, BrowserWindow, ipcMain, systemPreferences, Menu, dialog } = require('electron'); 
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

const username = os.userInfo().username;
const platform = os.platform();
const userDataPath = path.join(__dirname, 'src/settings/searchAreas.json');

async function readUserData() {
  try {
    const data = await fs.readFile(userDataPath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading user data:', err);
    return {};
  }
}

async function run(platform,level) {
  const data = await readUserData();
  if (!data.platform || !data.platform[platform] || !data.platform[platform]["searchAreas"]) {
    console.error('Invalid data structure');
    return [];
  }

  return data.platform[platform]["searchAreas"]
    .filter(x => level ? x[3] === level : true)
    .map(x => ({
      path: `${x[0]}/${username}/${x[2]}`,
      checked: x[3] === 1
    }));
}

async function updateUserData(dirPath, checked) {
  try {
    const data = await readUserData();
    const searchAreas = data.platform[platform]["searchAreas"];
    const updatedSearchAreas = searchAreas.map(area => {
      if (`${area[0]}/${username}/${area[2]}` === dirPath) {
        return [area[0], area[1], area[2], checked ? 1 : 0];
      }
      return area;
    });
    data.platform[platform]["searchAreas"] = updatedSearchAreas;
    await fs.writeFile(userDataPath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error updating user data:', err);
  }
}

async function createMenu(mainWindow) { 
  const directories = await run(platform,0);
  const checkboxes = directories.map(dir => ({
    label: dir.path,
    type: 'checkbox',
    checked: dir.checked,
    click: async (menuItem) => {
      mainWindow.webContents.send('checkbox-changed', { dir: dir.path, checked: menuItem.checked });
      await updateUserData(dir.path, menuItem.checked);
      mainWindow.reload()
    }
  }));

  const template = [
    {
      label: 'Navigation',
      submenu: [
        { label: 'Back', click: () => mainWindow.webContents.goBack() },
        { label: 'Forward', click: () => mainWindow.webContents.goForward() },
      ],
    },
    {
      label: 'Check',
      submenu: checkboxes
    },
    {
      label: 'Video',
      submenu: [
        {
          label: 'Video Aç',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [{ name: 'VidiFusion', extensions: ['mp4', 'avi', 'mkv'] }]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const videoPath = result.filePaths[0];
              startPythonServer(videoPath);
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
              webPreferences: { nodeIntegration: true, contextIsolation: false }
            });
            urlWindow.loadFile('src/url_input.html');
          }
        },
        {
          label: 'Video Klasörü Seç',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('directory-selected', result.filePaths[0]);
            }
          }
        },
        {
          label: 'Checkbox Örneği',
          type: 'checkbox',
          checked: false,
          click: (menuItem) => {
            console.log(`Checkbox is now ${menuItem.checked ? 'checked' : 'unchecked'}`);
            mainWindow.webContents.send('checkbox-changed', menuItem.checked);
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
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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

function startPythonServer(videoPath) {
  exec(`python3 ${path.join(__dirname, 'src/servers/server.py')}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error starting Python server: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Python server stderr: ${stderr}`);
      return;
    }
    console.log(`Python server stdout: ${stdout}`);
  }).on('close', (code) => {
    console.log(`Python server process exited with code ${code}`);
  });
}

ipcMain.on('open-playback-window', (event, videoPath) => {
  startPythonServer(videoPath);
  exec(`npm run start-playback -- "${encodeURIComponent(videoPath)}"`);
});

ipcMain.on('open-url', (event, url) => {
  const videoWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  videoWindow.loadURL(`file://${__dirname}/src/playback.html?video=${encodeURIComponent(url)}`);
  createMenu(videoWindow); 
});

app.whenReady().then(createWindow);

ipcMain.handle('get-videos', async () => {
  const videoExtensions = new Set(['.mp4', '.avi', '.mkv']);
  const videoPaths = {};

  async function findVideos(dir) {
    try {
      await fs.access(dir, fs.constants.R_OK | fs.constants.X_OK);
      const files = await fs.readdir(dir);

      await Promise.all(files.map(async (file) => {
        const fullPath = path.join(dir, file);
        const stat = await fs.lstat(fullPath);
        if (stat.isSymbolicLink()) return;
        if (stat.isDirectory()) {
          await findVideos(fullPath);
        } else if (videoExtensions.has(path.extname(fullPath).toLowerCase())) {
          const parentDir = path.basename(dir);
          if (!videoPaths[parentDir]) videoPaths[parentDir] = [];
          videoPaths[parentDir].push(fullPath);
        }
      }));
    } catch (err) {
      console.error(`Error accessing ${dir}: ${err.message}`);
    }
  }

  try {
    const directories = await run(platform,1);
    console.log('directories:', directories);
    await Promise.all(directories.map(dir => findVideos(dir.path)));
    return videoPaths;
  } catch (err) {
    console.error('Error scanning videos:', err);
    return {};
  }
});

ipcMain.handle('get-accent-color', () => {
  return process.platform === 'darwin' ? systemPreferences.getAccentColor() : '#0078D4'; 
});

ipcMain.handle('get-theme-color', () => {
  return process.platform === 'darwin' ? systemPreferences.getColor('window') : '#FFFFFF';
});