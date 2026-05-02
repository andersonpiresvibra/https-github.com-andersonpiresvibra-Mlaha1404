const fs = require('fs');
const https = require('https');
const path = require('path');

const AIRLINE_INFO = {
  'RG': { iata: 'G3', name: 'GOL' },
  'LA': { iata: 'LA', name: 'LATAM' },
  'AD': { iata: 'AD', name: 'AZUL' },
  'TP': { iata: 'TP', name: 'TAP' },
  'AF': { iata: 'AF', name: 'AIR FR' },
  'LH': { iata: 'LH', name: 'LUFTH' },
  'CM': { iata: 'CM', name: 'COPA' },
  'UA': { iata: 'UA', name: 'UNITED' },
  'AA': { iata: 'AA', name: 'AMERIC' },
  'KL': { iata: 'KL', name: 'KLM' },
  'DL': { iata: 'DL', name: 'DELTA' },
  'TT': { iata: 'TT', name: 'TOTAL' },
};

const dir = path.join(__dirname, '..', 'public', 'logos');
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

Object.values(AIRLINE_INFO).forEach(info => {
  const url = `https://images.kiwi.com/airlines/64/${info.iata}.png`;
  const filePath = path.join(dir, `${info.iata}.png`);
  
  https.get(url, (res) => {
    const fileStream = fs.createWriteStream(filePath);
    res.pipe(fileStream);
    fileStream.on('finish', () => {
      fileStream.close();
      console.log(`Downloaded: ${info.iata}.png`);
    });
  }).on('error', (err) => {
    console.error(`Error downloading ${info.iata}.png:`, err);
  });
});
