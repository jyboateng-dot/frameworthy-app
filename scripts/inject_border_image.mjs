import fs from 'fs';

const lines = fs.readFileSync('src/pages/framing/CustomizeFramePage.jsx', 'utf8').split('\n');
const start = lines.findIndex(l => l.includes('{/* Outer Frame Edge — 4 Mitered 3D Borders */}'));
const end = lines.findIndex((l, i) => i > start && l.includes('{/* Matting Background */}'));

if (start !== -1 && end !== -1) {
    const replacement = `                                                {/* Outer Frame Edge — 4 Mitered 3D Borders */}
                                                {selectedFrame?.borderImageSource ? (
                                                    <div 
                                                        className="absolute inset-0 transition-all duration-300 z-20 pointer-events-none"
                                                        style={{
                                                            borderStyle: "solid",
                                                            borderWidth: \`\${mouldingPctH}% \${mouldingPctW}%\`,
                                                            borderImageSource: \`url(\${selectedFrame.borderImageSource})\`,
                                                            borderImageSlice: "12%",
                                                            borderImageRepeat: "stretch"
                                                        }}
                                                    >
                                                        {/* Inner depth shadow */}
                                                        <div className="absolute inset-0 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] pointer-events-none z-20" />
                                                    </div>
                                                ) : (
                                                <div className="absolute inset-0 transition-all duration-300">
                                                    {/* Top */}
                                                    <FrameMouldingSide
                                                        side="top"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: \`\${mouldingPctH}%\`,
                                                            clipPath: \`polygon(0 0, 100% 0, \${100 - mouldingPctW}% 100%, \${mouldingPctW}% 100%)\`
                                                        }}
                                                    />
                                                    {/* Bottom */}
                                                    <FrameMouldingSide
                                                        side="bottom"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            bottom: 0,
                                                            left: 0,
                                                            right: 0,
                                                            height: \`\${mouldingPctH}%\`,
                                                            clipPath: \`polygon(\${mouldingPctW}% 0, \${100 - mouldingPctW}% 0, 100% 100%, 0 100%)\`
                                                        }}
                                                    />
                                                    {/* Left */}
                                                    <FrameMouldingSide
                                                        side="left"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            bottom: 0,
                                                            left: 0,
                                                            width: \`\${mouldingPctW}%\`,
                                                            clipPath: \`polygon(0 0, 100% \${mouldingPctH}%, 100% \${100 - mouldingPctH}%, 0 100%)\`
                                                        }}
                                                    />
                                                    {/* Right */}
                                                    <FrameMouldingSide
                                                        side="right"
                                                        frame={selectedFrame}
                                                        textureAnchor={frameTextureAnchor}
                                                        style={{
                                                            top: 0,
                                                            bottom: 0,
                                                            right: 0,
                                                            width: \`\${mouldingPctW}%\`,
                                                            clipPath: \`polygon(0 \${mouldingPctH}%, 100% 0, 100% 100%, 0 \${100 - mouldingPctH}%)\`
                                                        }}
                                                    />
                                                    
                                                    {/* Miter Joint Shadows */}
                                                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                                                        <line x1="0" y1="0" x2={\`\${mouldingPctW}%\`} y2={\`\${mouldingPctH}%\`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="100%" y1="0" x2={\`\${100 - mouldingPctW}%\`} y2={\`\${mouldingPctH}%\`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="0" y1="100%" x2={\`\${mouldingPctW}%\`} y2={\`\${100 - mouldingPctH}%\`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                        <line x1="100%" y1="100%" x2={\`\${100 - mouldingPctW}%\`} y2={\`\${100 - mouldingPctH}%\`} stroke="rgba(0,0,0,0.28)" strokeWidth="1" />
                                                    </svg>
                                                    
                                                    {/* Inner depth shadow */}
                                                    <div className="absolute inset-0 shadow-[inset_0_2px_12px_rgba(0,0,0,0.5)] pointer-events-none z-20" />
                                                </div>
                                                )}`;

    lines.splice(start, end - start, replacement);
    fs.writeFileSync('src/pages/framing/CustomizeFramePage.jsx', lines.join('\n'), 'utf8');
    console.log('Successfully injected border-image into CustomizeFramePage.jsx');
} else {
    console.log('Could not find start or end bounds in CustomizeFramePage.jsx', start, end);
}
