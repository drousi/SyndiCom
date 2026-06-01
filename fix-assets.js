const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

async function processImages() {
  const assetsDir = path.resolve('d:/DEV_PROJECTS/SyndiCom/assets');
  const backupDir = path.resolve('d:/DEV_PROJECTS/SyndiCom/assets/backup');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }

  // Files to process
  const files = [
    { name: 'icon.png', size: 1024, scale: 0.65, bg: '#0D1B2A' },
    { name: 'adaptive-icon.png', size: 1024, scale: 0.55, bg: '#0D1B2A' },
    { name: 'splash.png', size: 2048, scale: 0.45, bg: '#0D1B2A' }
  ];

  for (const file of files) {
    const filePath = path.join(assetsDir, file.name);
    if (!fs.existsSync(filePath)) {
      console.log(`Skipping ${file.name}, not found.`);
      continue;
    }

    // Backup
    fs.copyFileSync(filePath, path.join(backupDir, file.name));

    try {
      const image = await Jimp.read(path.join(backupDir, file.name));
      const targetSize = file.size;
      const logoSize = Math.floor(targetSize * file.scale);

      // Create new background
      const newImage = new Jimp(targetSize, targetSize, file.bg);
      
      // Resize original logo
      image.resize(logoSize, Jimp.AUTO);
      
      // Center logo on background
      const x = (targetSize - image.bitmap.width) / 2;
      const y = (targetSize - image.bitmap.height) / 2;
      
      newImage.composite(image, x, y);
      await newImage.writeAsync(filePath);
      console.log(`Processed ${file.name}`);
    } catch (e) {
      console.error(`Error processing ${file.name}:`, e);
    }
  }

  // Generate notification icon (white silhouette on transparent bg)
  // For this, we take the icon, make it white and transparent.
  // Actually, a simpler way is just to take the adaptive icon and make it all white where alpha > 0.
  // Note: if the logo itself is a full square, it will just become a white square.
  // The user should ideally use a proper silhouette. But we can generate a basic one.
  try {
    const iconPath = path.join(backupDir, 'icon.png');
    if (fs.existsSync(iconPath)) {
      const icon = await Jimp.read(iconPath);
      icon.resize(96, 96);
      icon.scan(0, 0, icon.bitmap.width, icon.bitmap.height, function(x, y, idx) {
        const alpha = this.bitmap.data[idx + 3];
        if (alpha > 0) {
          // If the pixel is not fully transparent, make it white
          // But wait, the original icon.png has a background!
          // So the alpha is always 255. It will just be a white square.
          // In this case, we'll try to guess if it's the background color (#0D1B2A)
          const r = this.bitmap.data[idx + 0];
          const g = this.bitmap.data[idx + 1];
          const b = this.bitmap.data[idx + 2];
          
          // #0D1B2A is rgb(13, 27, 42)
          const isBg = r < 30 && g < 40 && b < 60;
          if (isBg) {
            this.bitmap.data[idx + 3] = 0; // make transparent
          } else {
            this.bitmap.data[idx + 0] = 255; // R
            this.bitmap.data[idx + 1] = 255; // G
            this.bitmap.data[idx + 2] = 255; // B
            this.bitmap.data[idx + 3] = 255; // A
          }
        }
      });
      await icon.writeAsync(path.join(assetsDir, 'notification-icon.png'));
      console.log('Generated notification-icon.png');
    }
  } catch(e) {
    console.error('Error generating notification icon', e);
  }
}

processImages();
