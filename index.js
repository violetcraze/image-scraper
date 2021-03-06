const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
} = require('electron');
const puppeteer = require('puppeteer');
const fs = require('fs');
const sites = require('./sites.json');
const unhandled = require('electron-unhandled');
unhandled({
  showDialog: true,
});

let win;
let imgCount = 0;

function init() {
  createWindow();
}

function createWindow () {
  win = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: true
    }
  });

  win.loadFile('index.html');
}

ipcMain.on('scrap', async (event, msg) => {
  console.log(JSON.stringify(msg));
  await scrapSite(msg);
});

async function scrapSite(data) {
  if (!fs.existsSync('./images')){
    fs.mkdirSync('./images');
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  switch(data.site) {
    case 'tumblr.com':
      for (let i = 0; i < data.urls.length; ++i) {
        if (data.urls[i].pages) {
          for (let j = 0; j < data.urls[i].pages; ++j) {
            const url = pageUrl(data.urls[i].url, data.site, j);
            console.log(url);
            await scrapPage(page, url);
          }
        } else {
          await scrapPage(page, data.urls[i].url);
        }
      }
      break;
    default:
      for (let i = 0; i < data.urls.length; ++i) {
        await scrapPage(page, data.urls[i].url);
      }
  }

  await browser.close();
  console.log("done");
}

function pageUrl(url, site, index) {
  switch(site) {
    case 'tumblr.com':
      return url + (sites['tumblr.com'].pageFormat.replace('#', index));
    default:
      throw new Error("unknown page layout for " + site);
  }
}

async function scrapPage(page, url) {
  console.log("Scraping: " + url);
  await page.goto(url);
  let imgURLs = await getImageURLs(page);
  imgURLs = imgURLs.filter(e => e != null);
  if (imgURLs.length == 0) {
    throw new Error("Unable to find images at " + url);
  }
  await downloadImages(imgURLs, page);
}

async function getImageURLs(page) {
  return await page.evaluate((selector) => {
    const imgElements = document.querySelectorAll(selector);
    let imgUrls = [];
    for (let i = 0; i < imgElements.length; ++i) {
      imgUrls.push(imgElements[i].getAttribute('src'));
    }
    return imgUrls;
  }, 'img');
}

async function downloadImages(urls, page) {
  console.log(urls);
  for (let i = 0; i < urls.length; ++i) {
    console.log(urls[i]);
    const source = await page.goto(urls[i]);
    const urlParts = urls[i].split('.');
    fs.writeFile('images/' + imgCount++ + '.' + urlParts[urlParts.length - 1], await source.buffer(), err => err ? console.error(err) : (1));
  }
}

app.on('ready', init);