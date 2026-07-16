const fs = require('fs');

const path = 'src/pages/framing/CustomizeFramePage.jsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add import for FrameSelectionModal
if (!content.includes('FrameSelectionModal')) {
    content = content.replace(
        "import { FRAME_STYLES, FRAME_SIZES",
        "import FrameSelectionModal from '../../components/FrameSelectionModal';\nimport { FRAME_STYLES, FRAME_SIZES"
    );
}

// 2. Add state for showFrameModal
if (!content.includes('showFrameModal')) {
    content = content.replace(
        "const [selectedFrame, setSelectedFrame]",
        "const [showFrameModal, setShowFrameModal] = useState(false);\n    const [selectedFrame, setSelectedFrame]"
    );
}

// 3. Replace the massive Frame Styles Grid
const regex = /\{\/\* Frame Styles Grid \*\/\}[\s\S]*?(?=\{\/\* Upload Art)/;

const replacement = `{/* Frame Styles Grid */}
<div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-100">
    <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-white rounded-md border p-1 shadow-sm shrink-0">
            <img src={selectedFrame.previewImg || \`/frames/\${selectedFrame.filename}\`} alt={selectedFrame.name} className="w-full h-full object-cover rounded-sm" />
        </div>
        <div>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-0.5">{selectedFrame.category || 'Frame Style'}</div>
            <div className="text-sm font-semibold text-gray-900 leading-tight">{selectedFrame.name}</div>
        </div>
    </div>
    <button
        onClick={() => setShowFrameModal(true)}
        className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider rounded-md hover:bg-gray-800 transition-colors"
    >
        Change
    </button>
</div>

<FrameSelectionModal
    isOpen={showFrameModal}
    onClose={() => setShowFrameModal(false)}
    selectedFrame={selectedFrame}
    onSelect={setSelectedFrame}
/>

`;

content = content.replace(regex, replacement);

fs.writeFileSync(path, content);
console.log('CustomizeFramePage UI updated');
