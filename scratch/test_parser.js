const FRAME_SIZES = [
    { id: 'tabletop', label: 'Tabletop (5x7")', basePrice: 29, ratio: '5/7' },
    { id: 'sm', label: 'Small (8x10")', basePrice: 39, ratio: '4/5' },
    { id: 'md', label: 'Medium (12x16")', basePrice: 59, ratio: '3/4' },
    { id: 'lg', label: 'Large Portrait (18x24")', basePrice: 89, ratio: '3/4' },
    { id: 'lg-land', label: 'Large Landscape (24x18")', basePrice: 89, ratio: '4/3' },
    { id: 'xl', label: 'Statement Portrait (24x36")', basePrice: 129, ratio: '2/3' },
    { id: 'xl-land', label: 'Statement Landscape (36x24")', basePrice: 129, ratio: '3/2' },
];

FRAME_SIZES.forEach(size => {
    try {
        const wStr = size.label.split('(')[1].split('x')[0].trim();
        const hStr = size.label.split('x')[1].split('"')[0].trim();
        console.log(`[${size.id}] ${size.label} => Width: ${wStr}, Height: ${hStr}`);
    } catch (e) {
        console.error(`[${size.id}] ${size.label}`, e.message);
    }
});
