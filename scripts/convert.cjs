const fs = require('fs');
const data = fs.readFileSync('src/assets/Ennvo.png');
fs.writeFileSync('src/assets/EnnvoLogoBase64.ts', 'export const ennvoLogoBase64 = "data:image/png;base64,' + data.toString('base64') + '";\n');
console.log('done');
