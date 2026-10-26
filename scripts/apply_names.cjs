const fs = require('fs');
const path = require('path');

const allNamesPath = path.join(__dirname, 'all_names.json');
const allNames = JSON.parse(fs.readFileSync(allNamesPath, 'utf8'));

const constantsPath = path.join(__dirname, 'src', 'data', 'constants.jsx');
let constantsContent = fs.readFileSync(constantsPath, 'utf8');

let replacements = 0;
for (const [id, name] of Object.entries(allNames)) {
    // replace generic name
    const genericNameRegex = new RegExp(`name:\\s*'Frame ${id}'`, 'g');
    if (genericNameRegex.test(constantsContent)) {
        constantsContent = constantsContent.replace(genericNameRegex, `name: '${name}'`);
        replacements++;
        console.log(`Replaced 'Frame ${id}' with '${name}'`);
    }
    // replace desc
    const descRegex = new RegExp(`desc:\\s*'Custom frame style ${id}\\.'`, 'g');
    if (descRegex.test(constantsContent)) {
        constantsContent = constantsContent.replace(descRegex, `desc: '${name}.'`);
    }
}

if (replacements > 0) {
    fs.writeFileSync(constantsPath, constantsContent);
    console.log(`Updated ${replacements} frame names in constants.jsx.`);
} else {
    console.log('No generic names found to replace.');
}
