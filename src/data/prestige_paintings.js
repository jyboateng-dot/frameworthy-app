import SOURCE_DIMS from './source_dims.json';
import { getThumbnailUrl } from '../services/storage';

export const BASE = 'https://ik.imagekit.io/jybooboo187/inspiration_prestige_paintings/';

/* helper: derive dimensions from painting code */
const dimsFromCode = (code, filename) => {
    if (SOURCE_DIMS[filename]) return SOURCE_DIMS[filename];
    if (code.includes('C0X') || code.includes('A0X') || code.includes('G0X')) return '100 × 100 cm';
    if (code.includes('90C0')) return '90 × 120 cm';
    if (code.includes('80G0') || code.includes('80G')) return '120 × 80 cm';
    if (code.includes('80X') || code.includes('80F0')) return '80 × 80 cm';
    if (code.includes('70E0') || code.includes('70F0')) return '100 × 70 cm';
    if (code.includes('A0F0') || code.includes('0F0')) return '120 × 80 cm';
    if (code.includes('26') || code.includes('27') || code.includes('28')) return '80 × 40 cm';
    if (code.includes('20') || code.includes('24')) return '60 × 90 cm';
    return '90 × 90 cm';
};

/* helper: map series code to frame style */
const finishMap = (code) => {
    if (code.startsWith('DIPI-A')) return { label: 'Antique gold prestige canvas', style: 'frame-83878' };
    if (code.includes('W8') || code.includes('W84')) return { label: 'Ebony prestige canvas', style: 'frame-10512' };
    if (code.includes('Z6') || code.includes('Z5')) return { label: 'Slate grey prestige canvas', style: 'frame-83999' };
    return { label: 'Antique gold prestige canvas', style: 'frame-83878' };
};

const RAW_FILES = [
    'DIPI-A130C0X.jpg', 'DIPI-A137C0X.jpg', 'DIPI-A138A0X.jpg',
    'DIPI-W664A0F0.jpg', 'DIPI-W666A0F0.jpg', 'DIPI-W667A0F0.jpg',
    'DIPI-A15026.jpg', 'DIPI-A15126.jpg', 'DIPI-A15270E0.jpg',
    'DIPI-A15390C0.jpg', 'DIPI-A15490C0.jpg', 'DIPI-A15590C0.jpg',
    'DIPI-A15690C0.jpg', 'DIPI-A157C0X.jpg', 'DIPI-W73090C0.jpg',
    'DIPI-Z55228.jpg', 'DIPI-Z55328.jpg', 'DIPI-Z55428.jpg', 'DIPI-Z55528.jpg',
    'DIPI-Z562A0X.jpg',
    'DIPI-A20020.jpg', 'DIPI-A20120.jpg', 'DIPI-A20220.jpg', 'DIPI-A20320.jpg',
    'DIPI-A20480X.jpg', 'DIPI-A20580X.jpg', 'DIPI-A20627.jpg',
    'DIPI-A20750F0.jpg', 'DIPI-A20860F0.jpg', 'DIPI-A20950F0.jpg',
    'DIPI-A21070E0.jpg', 'DIPI-A21170E0.jpg', 'DIPI-A21270E0.jpg',
    'DIPI-A213A0X.jpg', 'DIPI-A214A0X.jpg', 'DIPI-A215A0X.jpg',
    'DIPI-A216A0X.jpg', 'DIPI-A217A0X.jpg', 'DIPI-A218A0X.jpg', 'DIPI-A219A0X.jpg',
    'DIPI-A22090C0.jpg', 'DIPI-A22190C0.jpg', 'DIPI-A22290C0.jpg',
    'DIPI-A22390C0.jpg', 'DIPI-A22490C0.jpg', 'DIPI-A22590C0.jpg',
    'DIPI-A22690C0.jpg', 'DIPI-A22790C0.jpg', 'DIPI-A22890C0.jpg',
    'DIPI-A22990C0.jpg', 'DIPI-A23090C0.jpg', 'DIPI-A23190C0.jpg',
    'DIPI-A23290C0.jpg', 'DIPI-A23390C0.jpg', 'DIPI-A23490C0.jpg',
    'DIPI-A23590C0.jpg', 'DIPI-A23690C0.jpg', 'DIPI-A237C0X.jpg',
    'DIPI-A238G0X.jpg', 'DIPI-A23980G0.jpg', 'DIPI-A24080G0.jpg',
    'DIPI-W80490X.jpg', 'DIPI-W81524.jpg', 'DIPI-W81624.jpg', 'DIPI-W81724.jpg',
    'DIPI-W83190C0.jpg', 'DIPI-W83290C0.jpg', 'DIPI-W83390C0.jpg',
    'DIPI-W83490C0.jpg', 'DIPI-W83590C0.jpg', 'DIPI-W83690C0.jpg',
    'DIPI-W83790C0.jpg', 'DIPI-W83890C0.jpg', 'DIPI-W83990C0.jpg',
    'DIPI-W84090C0.jpg', 'DIPI-W84190C0.jpg', 'DIPI-W84290C0.jpg',
    'DIPI-W84390C0.jpg', 'DIPI-W844A0X.jpg', 'DIPI-W845A0X.jpg',
    'DIPI-W846A0X.jpg', 'DIPI-W847A0X.jpg', 'DIPI-W848A0F0.jpg',
    'DIPI-W84980G0.jpg',
    'DIPI-Z662A0X.jpg', 'DIPI-Z67290C0.jpg', 'DIPI-Z67390C0.jpg',
    'DIPI-Z677A0F0.jpg', 'DIPI-Z678A0F0.jpg', 'DIPI-Z679A0F0.jpg', 'DIPI-Z680A0F0.jpg'
];



/* Build product catalog */
export const PRODUCTS = RAW_FILES.map((filename) => {
    const code = filename.replace('.jpg', '');
    const displayCode = code.replace('DIPI-', 'DIPI/');
    const info = finishMap(code);
    const dims = dimsFromCode(code, filename);

    let sizeId = 'md';
    if (dims.includes('120') || dims.includes('100')) sizeId = 'xl';
    else if (dims.includes('90') || dims.includes('80')) sizeId = 'lg';

    let series = 'other';
    if (code.includes('-A')) series = 'A';
    else if (code.includes('W84') || code.includes('W83') || code.includes('W80')) series = 'W8';
    else if (code.includes('W7')) series = 'W7';
    else if (code.includes('W6')) series = 'W6';
    else if (code.includes('-Z')) series = 'Z';

    return {
        id: filename,
        code: displayCode,
        title: `Prestige ${code.replace('DIPI-', '')}`,
        dims,
        finish: info.label,
        image: getThumbnailUrl(BASE + filename),
        fullRes: BASE + filename,
        frameStyleId: info.style,
        sizeId,
        series
    };
});

