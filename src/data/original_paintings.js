import SOURCE_DIMS from './source_dims.json';
import { FRAME_STYLES } from './constants';
import { getThumbnailUrl } from '../services/storage';

export const BASE = 'https://ik.imagekit.io/jybooboo187/inspiration_original_paintings/';

/* ── helpers ── */
const dimsFromCode = (code, filename) => {
    if (SOURCE_DIMS[filename]) return SOURCE_DIMS[filename];
    if (code.endsWith('90C0') || code.includes('3090')) return '90 × 120 cm';
    if (code.endsWith('90X')) return '90 × 90 cm';
    if (code.endsWith('40X') || code.endsWith('A0X')) return '100 × 100 cm';
    if (code.endsWith('30X')) return '30 × 30 cm';
    if (code.endsWith('60X')) return '60 × 60 cm';
    if (code.endsWith('80X')) return '80 × 80 cm';
    if (code.endsWith('80I0')) return '120 × 80 cm';
    if (code.endsWith('65F0')) return '100 × 65 cm';
    if (code.endsWith('6090')) return '90 × 60 cm';
    if (code.endsWith('27')) return '80 × 27 cm';
    if (code.endsWith('24')) return '80 × 24 cm';
    return '60 × 60 cm';
};

const finishMap = (code) => {
    if (code.startsWith('DIPI-W')) return { label: 'Walnut canvas frame', style: 'frame-10592' };
    if (code.startsWith('DIPI-Z')) return { label: 'Slate grey canvas frame', style: 'frame-83999' };
    return { label: 'Gold canvas frame', style: 'frame-83878' };
};

const RAW_FILES = [
    'DIPI-W04524.jpg','DIPI-W20524.jpg','DIPI-W21865F0.jpg','DIPI-W30660X.jpg',
    'DIPI-W53224.jpg','DIPI-W60030X.jpg','DIPI-W60130X.jpg','DIPI-W60230X.jpg',
    'DIPI-W60330X.jpg','DIPI-W60430X.jpg','DIPI-W60530X.jpg','DIPI-W60630X.jpg',
    'DIPI-W60930X.jpg','DIPI-W61130X.jpg','DIPI-W6153090.jpg','DIPI-W61824.jpg',
    'DIPI-W61924.jpg','DIPI-W62324.jpg','DIPI-W62424.jpg','DIPI-W62680X.jpg',
    'DIPI-W62727.jpg','DIPI-W62827.jpg','DIPI-W62927.jpg','DIPI-W63465F0.jpg',
    'DIPI-W637A0X.jpg','DIPI-W638A0X.jpg','DIPI-W639A0X.jpg','DIPI-W641A0X.jpg',
    'DIPI-W66090C0.jpg','DIPI-W66380I0.jpg','DIPI-W66890C0.jpg','DIPI-W66990C0.jpg',
    'DIPI-W67465F0.jpg','DIPI-W677A0X.jpg','DIPI-W678A0X.jpg','DIPI-W70030X.jpg',
    'DIPI-W70130X.jpg','DIPI-W70230X.jpg','DIPI-W70330X.jpg','DIPI-W70430X.jpg',
    'DIPI-W70530X.jpg','DIPI-W70630X.jpg','DIPI-W70730X.jpg','DIPI-W70860X.jpg',
    'DIPI-W70960X.jpg','DIPI-W71060X.jpg','DIPI-W71160X.jpg','DIPI-W71260X.jpg',
    'DIPI-W71324.jpg','DIPI-W71424.jpg','DIPI-W71524.jpg','DIPI-W71665F0.jpg',
    'DIPI-W71765F0.jpg','DIPI-W71865F0.jpg','DIPI-W71965F0.jpg','DIPI-W72065F0.jpg',
    'DIPI-W72165F0.jpg','DIPI-W72265F0.jpg','DIPI-W72365F0.jpg','DIPI-W72465F0.jpg',
    'DIPI-W72527.jpg','DIPI-W72627.jpg','DIPI-W72727.jpg','DIPI-W729A0X.jpg',
    'DIPI-W73290C0.jpg','DIPI-W73390C0.jpg','DIPI-W73490C0.jpg','DIPI-W73590C0.jpg',
    'DIPI-W7363090.jpg','DIPI-W7373090.jpg','DIPI-W7383090.jpg','DIPI-W7393090.jpg',
    'DIPI-W74380I0.jpg','DIPI-W74460X.jpg','DIPI-W8003090.jpg','DIPI-W8013090.jpg',
    'DIPI-W8023090.jpg','DIPI-W8033090.jpg','DIPI-W80560X.jpg','DIPI-W80660X.jpg',
    'DIPI-W80760X.jpg','DIPI-W80860X.jpg','DIPI-W80924.jpg','DIPI-W81024.jpg',
    'DIPI-W81124.jpg','DIPI-W81224.jpg','DIPI-W81324.jpg','DIPI-W81424.jpg',
    'DIPI-W81880X.jpg','DIPI-W81980X.jpg','DIPI-W82027.jpg','DIPI-W82165F0.jpg',
    'DIPI-W82265F0.jpg','DIPI-W82365F0.jpg','DIPI-W82465F0.jpg','DIPI-W825A0X.jpg',
    'DIPI-W826A0X.jpg','DIPI-W82790C0.jpg','DIPI-W82890C0.jpg','DIPI-W82990C0.jpg',
    'DIPI-W83090C0.jpg','DIPI-W85080I0.jpg',
    'DIPI-Z12424.jpg','DIPI-Z12724.jpg','DIPI-Z21127.jpg','DIPI-Z21227.jpg',
    'DIPI-Z33030X.jpg','DIPI-Z37430X.jpg','DIPI-Z40330X.jpg','DIPI-Z40430X.jpg',
    'DIPI-Z4153090.jpg','DIPI-Z4173090.jpg','DIPI-Z4183090.jpg','DIPI-Z4213090.jpg',
    'DIPI-Z4223090.jpg','DIPI-Z4233090.jpg','DIPI-Z43124.jpg','DIPI-Z43224.jpg',
    'DIPI-Z43880X.jpg','DIPI-Z44027.jpg','DIPI-Z44265F0.jpg','DIPI-Z44565F0.jpg',
    'DIPI-Z448A0X.jpg','DIPI-Z450A0X.jpg','DIPI-Z45190C0.jpg','DIPI-Z45680I0.jpg',
    'DIPI-Z45724.jpg','DIPI-Z46065F0.jpg','DIPI-Z46165F0.jpg','DIPI-Z46490C0.jpg',
    'DIPI-Z47227.jpg','DIPI-Z47824.jpg','DIPI-Z48130X.jpg','DIPI-Z48230X.jpg',
    'DIPI-Z48330X.jpg','DIPI-Z48430X.jpg','DIPI-Z50030X.jpg','DIPI-Z50130X.jpg',
    'DIPI-Z50230X.jpg','DIPI-Z50330X.jpg','DIPI-Z50430X.jpg','DIPI-Z50530X.jpg',
    'DIPI-Z50630X.jpg','DIPI-Z50730X.jpg','DIPI-Z5093090.jpg','DIPI-Z5103090.jpg',
    'DIPI-Z5113090.jpg','DIPI-Z5123090.jpg','DIPI-Z5133090.jpg','DIPI-Z5143090.jpg',
    'DIPI-Z5153090.jpg','DIPI-Z51660X.jpg','DIPI-Z51760X.jpg','DIPI-Z51860X.jpg',
    'DIPI-Z51960X.jpg','DIPI-Z52060X.jpg','DIPI-Z52160X.jpg','DIPI-Z52260X.jpg',
    'DIPI-Z52360X.jpg','DIPI-Z52460X.jpg','DIPI-Z52560X.jpg','DIPI-Z5266090.jpg',
    'DIPI-Z5276090.jpg','DIPI-Z5286090.jpg','DIPI-Z5306090.jpg','DIPI-Z5316090.jpg',
    'DIPI-Z5326090.jpg','DIPI-Z53480X.jpg','DIPI-Z53580X.jpg','DIPI-Z53680X.jpg',
    'DIPI-Z53780X.jpg','DIPI-Z53880X.jpg','DIPI-Z53980X.jpg','DIPI-Z54080X.jpg',
    'DIPI-Z54180X.jpg','DIPI-Z54227.jpg','DIPI-Z54727.jpg','DIPI-Z54827.jpg',
    'DIPI-Z54927.jpg','DIPI-Z55027.jpg','DIPI-Z55127.jpg','DIPI-Z55665F0.jpg',
    'DIPI-Z558A0X.jpg','DIPI-Z559A0X.jpg','DIPI-Z563A0X.jpg','DIPI-Z564A0X.jpg',
    'DIPI-Z56590C0.jpg','DIPI-Z56690C0.jpg','DIPI-Z56980I0.jpg','DIPI-Z57065F0.jpg',
    'DIPI-Z57165F0.jpg','DIPI-Z57265F0.jpg','DIPI-Z60030X.jpg','DIPI-Z60130X.jpg',
    'DIPI-Z60230X.jpg','DIPI-Z60330X.jpg','DIPI-Z60430X.jpg','DIPI-Z60530X.jpg',
    'DIPI-Z60630X.jpg','DIPI-Z60730X.jpg','DIPI-Z60830X.jpg','DIPI-Z60930X.jpg',
    'DIPI-Z61030X.jpg','DIPI-Z61130X.jpg','DIPI-Z61230X.jpg','DIPI-Z61330X.jpg',
    'DIPI-Z61430X.jpg','DIPI-Z61530X.jpg','DIPI-Z61630X.jpg','DIPI-Z6173090.jpg',
    'DIPI-Z6183090.jpg','DIPI-Z6193090.jpg','DIPI-Z6203090.jpg','DIPI-Z6213090.jpg',
    'DIPI-Z6223090.jpg','DIPI-Z6233090.jpg','DIPI-Z6243090.jpg','DIPI-Z6253090.jpg',
    'DIPI-Z6263090.jpg','DIPI-Z6273090.jpg','DIPI-Z62860X.jpg','DIPI-Z62960X.jpg',
    'DIPI-Z63060X.jpg','DIPI-Z63160X.jpg','DIPI-Z63224.jpg','DIPI-Z63324.jpg',
    'DIPI-Z63424.jpg','DIPI-Z63524.jpg','DIPI-Z63624.jpg','DIPI-Z63724.jpg',
    'DIPI-Z63824.jpg','DIPI-Z63924.jpg','DIPI-Z64024.jpg','DIPI-Z64124.jpg',
    'DIPI-Z64227.jpg','DIPI-Z64327.jpg','DIPI-Z64427.jpg','DIPI-Z64527.jpg',
    'DIPI-Z64627.jpg','DIPI-Z64727.jpg','DIPI-Z64827.jpg','DIPI-Z64927.jpg',
    'DIPI-Z65027.jpg','DIPI-Z65127.jpg','DIPI-Z65227.jpg','DIPI-Z65327.jpg',
    'DIPI-Z65427.jpg','DIPI-Z65565F0.jpg','DIPI-Z65665F0.jpg','DIPI-Z65765F0.jpg',
    'DIPI-Z65865F0.jpg','DIPI-Z65965F0.jpg','DIPI-Z66065F0.jpg','DIPI-Z661A0X.jpg',
    'DIPI-Z66390C0.jpg','DIPI-Z66490C0.jpg','DIPI-Z66590C0.jpg','DIPI-Z66690C0.jpg',
    'DIPI-Z66790C0.jpg','DIPI-Z66890C0.jpg','DIPI-Z67090C0.jpg','DIPI-Z67190C0.jpg',
    'DIPI-Z67480I0.jpg','DIPI-Z67580I0.jpg','DIPI-Z67680I0.jpg'
];



export const PRODUCTS = RAW_FILES.map((filename) => {
    const code = filename.replace('.jpg', '');
    const displayCode = code.replace('DIPI-', 'DIPI/');
    const info = finishMap(code);
    const dims = dimsFromCode(code, filename);
    const series = code.startsWith('DIPI-W') ? 'W' : 'Z';

    let sizeId = 'md';
    if (dims.includes('120') || dims.includes('90')) sizeId = 'lg';
    if (dims.includes('100')) sizeId = 'xl';

    const frameObj = FRAME_STYLES.find(f => f.id === info.style);
    const frameName = frameObj ? frameObj.name : info.label;

    return {
        id: filename,
        code: displayCode,
        title: `Original ${code.replace('DIPI-', '')}`,
        dims,
        finish: frameName,
        image: getThumbnailUrl(BASE + filename),
        fullRes: BASE + filename,
        frameStyleId: info.style,
        sizeId,
        series,
    };
});

