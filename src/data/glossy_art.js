import SOURCE_DIMS from './source_dims.json';
import { FRAME_STYLES } from './constants';
import { getThumbnailUrl } from '../services/storage';

export const BASE = 'https://res.cloudinary.com/uucoqdzr/image/upload/inspiration_glossy_art/';

/* ── Series codes → metadata ── */
const seriesInfo = {
    MM: { label: 'MM Series', desc: 'Mediterranean mood compositions', dims: '100 × 100 cm' },
    LS: { label: 'LS Series', desc: 'Landscape & seascape panoramas', dims: '120 × 60 cm' },
    AD: { label: 'AD Series', desc: 'Abstract decorative art', dims: '100 × 100 cm' },
    FB: { label: 'FB Series', desc: 'Floral & botanical glossy prints', dims: '80 × 120 cm' },
    RT: { label: 'RT Series', desc: 'Retro & tonal art prints', dims: '60 × 60 cm' },
};

const getSeries = (code) => {
    const match = code.match(/GLOSS-([A-Z]+)\d/);
    return match ? match[1] : 'OTHER';
};

const getFinish = (code) => {
    if (code.endsWith('A0M0')) return 'Glossy matt finish';
    if (code.endsWith('A0F0')) return 'Glossy satin finish';
    if (code.endsWith('A0X')) return 'Glossy XL format';
    return 'Glossy art print';
};

const getDims = (code, filename) => {
    if (SOURCE_DIMS[filename]) return SOURCE_DIMS[filename];
    const s = getSeries(code);
    return seriesInfo[s]?.dims || '80 × 80 cm';
};

const RAW_FILES = [
    'GLOSS-MM01A0M0.jpg', 'GLOSS-MM02A0M0.jpg',
    'GLOSS-MM19A0F0.jpg', 'GLOSS-MM21A0F0.jpg',
    'GLOSS-MM22A0M0.jpg', 'GLOSS-MM23A0F0.jpg',
    'GLOSS-MM24A0F0.jpg', 'GLOSS-MM25A0F0.jpg',
    'GLOSS-LS01A0F0.jpg', 'GLOSS-LS02A0F0.jpg',
    'GLOSS-LS03A0F0.jpg', 'GLOSS-LS04A0F0.jpg',
    'GLOSS-LS05A0M0.jpg', 'GLOSS-LS06A0M0.jpg',
    'GLOSS-AD01A0X.jpg',  'GLOSS-AD02A0X.jpg',
    'GLOSS-FB01A0F0.jpg', 'GLOSS-FB02A0F0.jpg', 'GLOSS-FB03A0F0.jpg',
    'GLOSS-RT10A0F0.jpg', 'GLOSS-RT11A0F0.jpg',
    'GLOSS-RT12A0F0.jpg', 'GLOSS-RT13A0F0.jpg',
];



export const PRODUCTS = RAW_FILES.map((filename) => {
    const code = filename.replace('.jpg', '');
    const displayCode = code.replace('GLOSS-', 'GLOSS/');
    const series = getSeries(code);
    const info = seriesInfo[series] || { label: 'Glossy Art', desc: 'Premium glossy art print', dims: '80 × 80 cm' };

    return {
        id: filename,
        code: displayCode,
        title: `Glossy ${code.replace('GLOSS-', '')}`,
        dims: getDims(code, filename),
        finish: getFinish(code),
        seriesLabel: info.label,
        seriesDesc: info.desc,
        image: getThumbnailUrl(BASE + filename),
        fullRes: BASE + filename,
        frameStyleId: 'slate-grey-square-shadow',
        sizeId: code.endsWith('A0X') ? 'xl' : 'lg',
        series,
    };
});

