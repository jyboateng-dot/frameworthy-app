const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'src');
const targetText = `<button onClick={() => navigate && navigate('/refund-policy')} className="hover:text-white transition-colors text-left">Refund &amp; Return Policy</button>`;
const replacementText = `<button onClick={() => navigate && navigate('/refund-policy')} className="hover:text-white transition-colors text-left">Refund &amp; Return Policy</button>
                                <button onClick={() => navigate && navigate('/delivery-policy')} className="hover:text-white transition-colors text-left">Delivery Policy</button>`;

function walkDir(dir) {
    let modifiedFiles = [];
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.lstatSync(fullPath).isDirectory()) {
            modifiedFiles = modifiedFiles.concat(walkDir(fullPath));
        } else if (fullPath.endsWith('.jsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes(targetText)) {
                content = content.replace(targetText, replacementText);
                fs.writeFileSync(fullPath, content, 'utf8');
                modifiedFiles.push(fullPath);
            }
        }
    });
    return modifiedFiles;
}

console.log(walkDir(targetDir));
