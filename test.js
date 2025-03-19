const path = require('path');
const os = require('os');
const fs = require('fs').promises;

const userDataPath = path.join(__dirname, 'src/searchAreas.json');

async function readUserData() {
    try {
        const data = await fs.readFile(userDataPath, 'utf8');
        const userData = JSON.parse(data);
        return userData;
    } catch (err) {
        console.error('Error reading user data:', err);
        return {};
    }
}

async function run(platform) {
    const data = await readUserData();
    const search = data["platform"][platform]["searchAreas"];

    console.log(search);
    return search;
  }

  run("linux");