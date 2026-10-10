const fs = require('fs');

const path = 'src/pages/framing/CustomizeFramePage.jsx';
let content = fs.readFileSync(path, 'utf8');

const helper = `const getSideBackground = (side, frame) => {
    // Generate 3D gradient mathematically using the frame's baseColor
    let hex = frame.baseColor || '#8b4513';
    
    // Simple helper to adjust brightness
    const adjustBrightness = (col, amt) => {
        let usePound = false;
        if (col[0] === '#') {
            col = col.slice(1);
            usePound = true;
        }
        let num = parseInt(col, 16);
        let r = (num >> 16) + amt;
        if (r > 255) r = 255; else if (r < 0) r = 0;
        let b = ((num >> 8) & 0x00FF) + amt;
        if (b > 255) b = 255; else if (b < 0) b = 0;
        let g = (num & 0x0000FF) + amt;
        if (g > 255) g = 255; else if (g < 0) g = 0;
        return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
    };

    const light = adjustBrightness(hex, 40);
    const midLight = adjustBrightness(hex, 10);
    const midDark = adjustBrightness(hex, -20);
    const dark = adjustBrightness(hex, -50);

    const gradientStr = \`\${light} 0%, \${midLight} 40%, \${midDark} 70%, \${dark} 100%\`;

    if (side === 'top') return \`linear-gradient(to bottom, \${gradientStr})\`;
    if (side === 'bottom') return \`linear-gradient(to top, \${gradientStr})\`;
    if (side === 'left') return \`linear-gradient(to right, \${gradientStr})\`;
    if (side === 'right') return \`linear-gradient(to left, \${gradientStr})\`;
    
    return hex;
};`;

content = content.replace(/const getSideBackground = \(side, frame\) => \{[\s\S]*?^\s*\};/m, helper);
fs.writeFileSync(path, content);
console.log('CustomizeFramePage updated getSideBackground');
