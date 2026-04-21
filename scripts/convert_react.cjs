const fs = require('fs');
const data = fs.readFileSync('src/assets/Ennvo_small.jpg');
fs.writeFileSync('src/components/EnnvoLogo.tsx', `import React from 'react';

// Embedded Base64 Logo ensures it's packaged within JS and works 100% offline
const ennvoBase64 = "data:image/jpeg;base64,` + data.toString('base64') + `";

export const EnnvoLogo = ({ className = "" }: { className?: string }) => {
  return <img src={ennvoBase64} alt="Ennvo Logo" className={\`object-cover \${className}\`} />;
};
`);
console.log('Component created');
