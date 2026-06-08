const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, 'assets', 'transparent-splash.png');
const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

fs.writeFileSync(targetPath, Buffer.from(base64Image, 'base64'));
console.log('✅ Fichier transparent créé avec succès : ' + targetPath);
