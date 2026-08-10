import fs from 'fs';

let content = fs.readFileSync('src/pages/framing/CustomizeFramePage.jsx', 'utf8');

const badString = `                                    <p className="text-[10px] text-stone-500">
                                        )}
                                    </p>`;
                                    
const goodString = `                                    <p className="text-[10px] text-stone-500">{isPreset && presetDims ? presetDims : selectedFrame.category}</p>`;

content = content.replace(badString, goodString);
fs.writeFileSync('src/pages/framing/CustomizeFramePage.jsx', content, 'utf8');
