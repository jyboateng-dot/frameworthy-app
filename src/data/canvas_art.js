import SOURCE_DIMS from './source_dims.json';
import { FRAME_STYLES } from './constants';
import { getThumbnailUrl } from '../services/storage';

export const BASE = 'https://res.cloudinary.com/uucoqdzr/image/upload/inspiration_canvas_art/';

/* ── helpers ── */
const dimsFromCode = (code, filename) => {
    if (SOURCE_DIMS[filename]) return SOURCE_DIMS[filename];
    if (code.includes('80B0')) return '120 × 80 cm';
    if (code.includes('4080')) return '80 × 40 cm';
    if (code.includes('50F0')) return '100 × 50 cm';
    if (code.includes('80B0') || code.includes('0B0')) return '120 × 80 cm';
    if (code.includes('25X')) return '100 × 25 cm';
    if (code.endsWith('17')) return '60 × 17 cm';
    if (code.endsWith('25')) return '60 × 25 cm';
    if (code.includes('10')) return '60 × 10 cm';
    return '60 × 60 cm';
};

const RAW_FILES = [
    'CANVA-027280B0.jpg',
    'CANVA-030017.jpg','CANVA-030117.jpg','CANVA-030217.jpg','CANVA-030317.jpg',
    'CANVA-030417.jpg','CANVA-030517.jpg','CANVA-030617.jpg','CANVA-030717.jpg',
    'CANVA-030817.jpg','CANVA-030917.jpg','CANVA-031017.jpg','CANVA-031117.jpg',
    'CANVA-031217.jpg','CANVA-031317.jpg','CANVA-031417.jpg','CANVA-031517.jpg',
    'CANVA-031617.jpg','CANVA-031717.jpg',
    'CANVA-03184080.jpg','CANVA-03194080.jpg','CANVA-03204080.jpg','CANVA-03214080.jpg',
    'CANVA-03224080.jpg','CANVA-03234080.jpg','CANVA-03244080.jpg','CANVA-03254080.jpg',
    'CANVA-03264080.jpg','CANVA-03274080.jpg','CANVA-03284080.jpg','CANVA-03294080.jpg',
    'CANVA-03304080.jpg','CANVA-03314080.jpg','CANVA-03324080.jpg','CANVA-03334080.jpg',
    'CANVA-03344080.jpg','CANVA-03354080.jpg','CANVA-03364080.jpg','CANVA-03374080.jpg',
    'CANVA-03384080.jpg','CANVA-03394080.jpg','CANVA-03404080.jpg','CANVA-03414080.jpg',
    'CANVA-034225.jpg','CANVA-034325.jpg','CANVA-034425.jpg','CANVA-034525.jpg',
    'CANVA-034625.jpg','CANVA-034725.jpg','CANVA-034825.jpg','CANVA-034925.jpg',
    'CANVA-035025.jpg','CANVA-035125.jpg','CANVA-035225.jpg','CANVA-035325.jpg',
    'CANVA-035425.jpg','CANVA-035525.jpg','CANVA-035625.jpg','CANVA-035725.jpg',
    'CANVA-035880B0.jpg','CANVA-035980B0.jpg','CANVA-036080B0.jpg','CANVA-036180B0.jpg',
    'CANVA-036280B0.jpg','CANVA-036380B0.jpg','CANVA-036480B0.jpg','CANVA-036580B0.jpg',
    'CANVA-036680B0.jpg','CANVA-036780B0.jpg','CANVA-036880B0.jpg','CANVA-036980B0.jpg',
    'CANVA-037080B0.jpg','CANVA-037180B0.jpg','CANVA-037280B0.jpg',
    'CANVA-037350F0.jpg','CANVA-037450F0.jpg','CANVA-037550F0.jpg','CANVA-037650F0.jpg',
    'CANVA-037750F0.jpg','CANVA-037850F0.jpg','CANVA-037950F0.jpg','CANVA-038050F0.jpg',
    'CANVA-038150F0.jpg','CANVA-038250F0.jpg','CANVA-038350F0.jpg','CANVA-038450F0.jpg',
    'CANVA-MIXM10.jpg','CANVA-MIXM25X.jpg',
    'CANVA-MIXN10.jpg','CANVA-MIXN25X.jpg',
    'CANVA-MIXO10.jpg','CANVA-MIXO25X.jpg',
];

export const SERIES_TABS = [
    { label: 'All', value: 'all' },
    { label: 'Narrow Strip', value: 'narrow' },
    { label: '40 × 80 cm', value: '4080' },
    { label: '120 × 80 cm', value: 'b0' },
    { label: '100 × 50 cm', value: '50f0' },
    { label: 'MIX Sets', value: 'mix' },
];

const getSeries = (code) => {
    if (code.includes('MIX')) return 'mix';
    if (code.includes('80B0') || code.includes('0B0')) return 'b0';
    if (code.includes('4080')) return '4080';
    if (code.includes('50F0')) return '50f0';
    if (code.endsWith('17') || code.endsWith('25') || code.endsWith('10')) return 'narrow';
    return 'narrow';
};

export const PRODUCTS = RAW_FILES.map((filename) => {
    const code = filename.replace('.jpg', '');
    const displayCode = code.replace('CANVA-', 'CANVA/');
    const dims = dimsFromCode(code, filename);
    const series = getSeries(code);
    const isMix = code.includes('MIX');

    const finish = isMix
        ? 'Multi-panel canvas set'
        : code.includes('80B0') || code.includes('0B0')
            ? 'Premium canvas — 120 × 80 cm'
            : code.includes('4080')
                ? 'Canvas panel — 80 × 40 cm'
                : code.includes('50F0')
                    ? 'Canvas panel — 100 × 50 cm'
                    : 'Narrow canvas strip';

    return {
        id: filename,
        code: displayCode,
        title: isMix
            ? `Canvas Mix Set ${code.replace('CANVA-MIX', '')}`
            : `Canvas ${code.replace('CANVA-', '')}`,
        dims,
        finish,
        image: getThumbnailUrl(BASE + filename),
        fullRes: BASE + filename,
        frameStyleId: 'black-walnut-shadow',
        sizeId: code.includes('80B0') || code.includes('0B0') ? 'xl' : code.includes('4080') ? 'lg' : 'md',
        series,
    };
});

