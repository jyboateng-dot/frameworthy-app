import SOURCE_DIMS from './source_dims.json';
import { getThumbnailUrl } from '../services/storage';

export const BASE = 'https://ik.imagekit.io/jybooboo187/framed_prints/';

export const dimsFromFile = (file) => {
    if (SOURCE_DIMS[file]) return SOURCE_DIMS[file];
    
    // Web sizes in filenames
    if (file.includes('13x18')) return '13 x 18 cm';
    if (file.includes('20x25')) return '20 x 25 cm';
    if (file.includes('21x30')) return '21 x 30 cm';
    if (file.includes('30x40')) return '30 x 40 cm';
    if (file.includes('40x50')) return '40 x 50 cm';
    if (file.includes('50x70')) return '50 x 70 cm';
    if (file.includes('60x80')) return '60 x 80 cm';
    if (file.includes('70x100')) return '70 x 100 cm';
    
    // Original Painting / Collections codes
    if (file.includes('90C0') || file.includes('3090')) return '90 x 120 cm';
    if (file.includes('A0F0')) return '100 x 150 cm';
    if (file.includes('40X') || file.includes('A0X')) return '100 x 100 cm';
    if (file.includes('90X')) return '90 x 90 cm';
    if (file.includes('30X')) return '30 x 30 cm';
    if (file.includes('60X')) return '60 x 60 cm';
    if (file.includes('80X')) return '80 x 80 cm';
    if (file.includes('80I0')) return '80 x 120 cm';
    if (file.includes('65F0')) return '65 x 100 cm';
    if (file.includes('6090')) return '60 x 90 cm';
    
    // Fallback
    return '40 x 50 cm';
};

export const finishMap = {
    '6340': { label: 'Brown wood', style: 'frame-10729' },
    '6375': { label: 'Black lacquered wood', style: 'frame-10512' },
    '6390': { label: 'Gold leaf moulding', style: 'frame-11169' },
    '6440': { label: 'Silver lacquered wood', style: 'frame-83812' },
    '6470': { label: 'Bronze lacquered wood', style: 'frame-84132' },
    '6540': { label: 'Deep brown wood', style: 'frame-10729' },
    '6570': { label: 'Deep brown wood', style: 'frame-10729' },
    '6585': { label: 'Silver lacquered wood', style: 'frame-83812' },
    '6635': { label: 'Black lacquered wood', style: 'frame-10512' },
    '6650': { label: 'Bronze lacquered wood', style: 'frame-84132' },
    'SET':  { label: 'Mixed finish - gallery set', style: 'frame-10512' },
};

export const artImages = [
    'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1578926288207-32356a15b4e4?auto=format&fit=crop&w=600&q=80',
    'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=600&q=80',
];

export const RAW_FILES = [
    '6340S-NA0311.jpg', '6340SC010140X.jpg', '6340SC010240X.jpg', '6340SC010411.jpg', '6375S-010508.jpg', '6375S-010608.jpg', '6375S-010708.jpg', '6375S-010808.jpg', '6375SC040140X.jpg', '6375SC040240X.jpg', '6375SC060311.jpg', '6375SC060411.jpg', '6390SCOO0118.jpg', '6390SCOO0240X.jpg', '6390SCOO0311.jpg', '6390SCOO0420X.jpg', '6440S-010140X.jpg', '6440S-010311.jpg', '6440S-020240X.jpg', '6440S-020411.jpg', '6440S-050508.jpg', '6440S-050608.jpg', '6440S-050708.jpg', '6440S-050808.jpg', '6470S-070508.jpg', '6470S-070608.jpg', '6470S-070708.jpg', '6470S-070808.jpg', '6470SC020311.jpg', '6470SC020411.jpg', '6470SC030140X.jpg', '6470SC030240X.jpg', '6540S-010608.jpg', '6540S-010808.jpg', '6540S-040508.jpg', '6540S-040608.jpg', '6540S-040708.jpg', '6540S-040808.jpg', '6540S-04A508.jpg', '6540S-04A708.jpg', '6540SC010311.jpg', '6540SC010411.jpg', '6540SC020240X.jpg', '6540SC020411.jpg', '6540SC030140X.jpg', '6540SC030311.jpg', '6540SC040140X.jpg', '6540SC040240X.jpg', '6570S-010508.jpg', '6570S-010708.jpg', '6570S-020608.jpg', '6570S-020808.jpg', '6570SC010311.jpg', '6570SC010411.jpg', '6570SC020140X.jpg', '6570SC020240X.jpg', '6585S-010508.jpg', '6585S-010608.jpg', '6585S-010708.jpg', '6585S-010808.jpg', '6585S-05A420X.jpg', '6585SC02A311.jpg', '6585SC050140X.jpg', '6585SC050240X.jpg', '6585SC05A240X.jpg', '6585SC070311.jpg', '6585SC070411.jpg', '6585SC08A118.jpg', '6635S-010311.jpg', '6635S-010420X.jpg', '6635SC010118.jpg', '6635SC010240X.jpg', '6650S-020608.jpg', '6650S-020708.jpg', '6650S-070508.jpg', '6650S-070808.jpg', '6650SC020140X.jpg', '6650SC020240X.jpg', '6650SC070311.jpg', '6650SC070411.jpg', 'SET-0001.jpg', 'SET-0002.jpg', 'SET-0003.jpg', 'SET-0007.jpg', 'SET-0008.jpg', 'SET-0009.jpg', 'SET-0010.jpg', 'SET-0016.jpg', 'SET-0017.jpg', 'SET-0018.jpg', 'SET-0019.jpg', 'SET-0020.jpg', 'SET-0022.jpg', 'SET-0023.jpg', 'SET-0024.jpg', 'SET-0028.jpg', 'SET-0029.jpg', 'SET-0030.jpg', 'SET-0031.jpg', 'SET-0032.jpg'
];

export const PRODUCTS = RAW_FILES.map((file, i) => {
    const seriesMatch = file.match(/^(\d{4}|SET)/);
    const series = seriesMatch ? seriesMatch[1] : 'SET';
    const info = finishMap[series] || finishMap['SET'];
    const isSet = series === 'SET';
    const code = file.replace(/\.jpg$/, '');
    const displayCode = isSet ? code.replace('SET-', 'SET/') : code.replace(/^(\d{4})/, '$1/').replace(/([SC]+)/, '$1/').replace(/(\d{2})(\w+)$/, '$1/$2');
    const fullResUrl = BASE + file;
    const thumbUrl = getThumbnailUrl(fullResUrl);

    return {
        id: file,
        code: displayCode,
        title: isSet ? `Gallery Set ${code.replace('SET-', '')}` : `Framed Print ${series}`,
        dims: isSet ? 'Gallery set' : dimsFromFile(file),
        finish: info.label,
        image: thumbUrl,
        fullRes: fullResUrl,
        artImage: artImages[i % artImages.length],
        frameStyleId: info.style,
        sizeId: isSet ? 'xl' : 'md',
        thickness: 'thin',
        layout: isSet ? 'gallery' : 'single',
        series,
    };
});
