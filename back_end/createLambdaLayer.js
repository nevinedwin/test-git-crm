const fs = require('fs')
const archiver = require('archiver')
const { promisify } = require('util')
const rimraf = promisify(require('rimraf'))
const ncp = promisify(require('ncp'))

async function pckg() {
    if (fs.existsSync('nodejs.zip')) {
        fs.unlinkSync('nodejs.zip')
    }
    if (!fs.existsSync("NPMLayer")) {
        fs.mkdirSync("NPMLayer");
    }
    await ncp('NPMLayer/node_modules/puppeteer/.local-chromium', '.local-chromium')
    await rimraf('NPMLayer/node_modules/puppeteer/.local-chromium')

    const output = fs.createWriteStream('NPMLayer/nodejs.zip')
    const archive = archiver('zip')
    archive.pipe(output)

    archive.directory('NPMLayer/node_modules/', 'nodejs/node_modules');
    await archive.finalize()
    await ncp('.local-chromium', 'NPMLayer/node_modules/puppeteer/.local-chromium')
    await rimraf('.local-chromium')
    console.log('nodejs.zip is ready')
}

pckg().catch(console.error)