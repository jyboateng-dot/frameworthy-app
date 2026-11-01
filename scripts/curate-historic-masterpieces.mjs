import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MET_LOCAL_COLLECTIONS } from '../src/data/metLocal.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'public/museum-data/historic-masterpieces.json');
const SEARCH_INDEX_OUTPUT = path.join(ROOT, 'public/museum-data/search-index.json');
const MET_DIMS_PATH = path.join(ROOT, 'src/data/metArtworkPixelDimensions.json');

// Curated 100-piece cross-museum Historic Masterpieces selection drawn from
// FrameWorthy's public-domain museum categories. Every piece has a named
// master artist, print-ready resolution, and canonical title/artist metadata.
const SELECTION = {
    met: [
        // Classic Masterpieces
        'met_local_k3lg778zc', // Gabriël Metsu — A Woman Seated at a Window
        'met_local_texrxk8bz', // Thomas de Keyser — A Musician and His Daughter
        'met_local_3wha099g7', // Gerard ter Borch the Younger — Curiosity
        'met_local_xm18b3bjk', // Rembrandt van Rijn — Bellona
        'met_local_p8hmu0lfb', // Johannes Vermeer — A Maid Asleep
        'met_local_k9icb21kq', // Gerard de Lairesse — Apollo and Aurora
        'met_local_4ksjwktc0', // Gabriël Metsu — A Musical Party
        'met_local_nyjuk1qcf', // Rembrandt van Rijn — Aristotle with a Bust of Homer
        'met_local_rynre5f30', // Michiel Sweerts — Clothing the Naked
        'met_local_jp7i86yqf', // Georges Seurat — Circus Sideshow (Parade de cirque)
        'met_local_24s02xhxh', // Rembrandt van Rijn — Man with a Magnifying Glass
        'met_local_q56t3j6af', // Anthony van Dyck — James Stuart, Duke of Richmond and Lennox
        'met_local_810q0jh7j', // Rembrandt van Rijn — Man in a Turban
        'met_local_oh5f2i89d', // Rembrandt van Rijn — Hendrickje Stoffels
        'met_local_lwv1h6tpt', // Rembrandt van Rijn — Head of Christ
        'met_local_c3l6ho3w6', // Diego Velázquez — Mariana of Austria, Queen of Spain
        'met_local_d88lbo815', // Diego Velázquez — Juan de Pareja
        'met_local_0si11ycsh', // Pieter de Hooch — Interior with a Young Couple
        // Vincent van Gogh & Post-Impressionism / Realism
        'met_local_if140ue57', // Vincent van Gogh — Cypresses
        'met_local_ch90s8ge3', // Vincent van Gogh — Irises
        'met_local_4o4414qu0', // Vincent van Gogh — La Berceuse (Woman Rocking a Cradle)
        'met_local_5a3lrn055', // Vincent van Gogh — First Steps, after Millet
        'met_local_hxt7ic35o', // Paul Cézanne — Dish of Apples
        'met_local_ony4c9k0a', // Peter Paul Rubens — A Forest at Dawn with a Deer Hunt
        'met_local_es06239u3', // Jean-François Millet — Haystacks: Autumn
        // Claude Monet & Impressionism
        'met_11936',           // Claude Monet — The Old Mill (Vieux Moulin)
        'met_12447',           // Claude Monet — Two Girls with Parasols
        'met_334174',          // Claude Monet — A Woman Fishing
        'met_local_nb68iavdv', // Édouard Manet — Boy with a Sword
        'met_local_4g7tah3ii', // Édouard Manet — Boating
        'met_local_5atmuloi9', // Pierre-Auguste Renoir — A Road in Louveciennes
        'met_local_9t6wmr7et', // Camille Pissarro — Haystacks, Morning, Éragny
        'met_local_yktwv7e3k', // Gustave Caillebotte — Chrysanthemums in the Garden at Petit-Gennevilliers
        // Japanese Prints & European Paintings
        'met_local_0bmeiikgw', // Katsushika Hokusai — Cranes on Branch of Snow-covered Pine
        'met_local_uwncytfyl', // Utagawa Hiroshige — Kameyama: Clear Weather After Snow
        'met_local_us9xe6rkx', // Hieronymus Bosch — Christ's Descent into Hell
    ],
    cleveland: [
        '148758', // Caravaggio — The Crucifixion of Saint Andrew
        '150389', // Nicolas Poussin — The Holy Family on the Steps
        '131583', // Peter Paul Rubens — The Feast of Herod
        '135382', // Claude Monet — The Red Kerchief
        '135299', // Vincent van Gogh — Adeline Ravoux
        '125104', // Edgar Degas — Frieze of Dancers
        '138464', // Jacques-Louis David — Cupid and Psyche
        '127115', // Paul Gauguin — Head of a Tahitian Woman
        '160885', // Frans Hals — Portrait of Tieleman Roosterman
        '111702', // Canaletto — Capriccio: A Palace with a Courtyard by the Lagoon
        '123431', // Jean-Honoré Fragonard — Invocation to Love
        '137259', // Gustave Courbet — Mme L... (Laure Borreau)
        '110565', // Théodore Géricault — Fighting Horses
        '130150', // François Boucher — Fountain with Two Tritons Blowing Conch Shells
        '109295', // Jean-Auguste-Dominique Ingres — Madame Désiré Raoul-Rochette
        '109042', // Honoré Daumier — Art Lovers
        '141639', // Frederic Edwin Church — Twilight in the Wilderness
        '93014',  // Thomas Cole — View of Schroon Mountain, Essex County, New York, After a Storm
        '151904', // Thomas Eakins — The Biglin Brothers Turning the Stake
        '92937',  // George Bellows — Stag at Sharkey's
        '94979',  // John Singleton Copley — Nathaniel Hurd
        '102578', // William Merritt Chase — Portrait of Dora Wheeler
        '173965', // Edward Hopper — Lighthouse Village (Cape Elizabeth)
        '108501', // Albrecht Dürer — Melencolia I
        '123964', // Albrecht Dürer — Adam and Eve
        '143142', // Antonio del Pollaiuolo — Battle of the Nudes
    ],
    chicago: [
        '142373354', // El Greco — Assumption of the Virgin
        '182633193', // Winslow Homer — Fishing off Scarborough
        '110438359', // Winslow Homer — Croquet Scene
        '141023057', // John Singer Sargent — Portrait of Charles Deering
        '164503289', // Henry Fuseli — Head of a Damned Soul from Dante's "Inferno"
        '125332959', // Henri Rousseau — War
        '195574855', // Albrecht Dürer — Young Bull
    ],
    rijksmuseum: [
        '151881110', // Judith Leyster — Two Children with a Cat
    ],
    paris: [
        '198427750', // Robert Lefèvre — Portrait of Napoleon I
    ],
    nga: [
        '5',  // Fra Angelico — The Madonna of Humility
        '9',  // Masaccio — The Madonna of Humility
        '10', // Duccio di Buoninsegna — The Nativity with the Prophets Isaiah and Ezekiel
        '18', // Masolino da Panicale — The Annunciation
        '19', // Andrea del Castagno — Portrait of a Man
        '20', // Filippino Lippi — The Adoration of the Child
        '21', // Sandro Botticelli — Portrait of a Youth
        '23', // Sandro Botticelli — Madonna and Child
        '24', // Sandro Botticelli — The Adoration of the Magi
        '26', // Raphael — The Alba Madonna
        '27', // Raphael — The Niccolini-Cowper Madonna
        '28', // Raphael — Saint George and the Dragon
        '32', // Vittore Carpaccio — The Flight into Egypt
        '36', // Giovanni Bellini — Portrait of a Young Man in Red
        '37', // Antonello da Messina — Madonna and Child
        '41', // Titian — Venus with a Mirror
        '45', // Paolo Veronese — The Finding of Moses
        '46', // Jan van Eyck — The Annunciation
        '47', // Petrus Christus — The Nativity
        '48', // Hans Memling — Madonna and Child with Angels
        '49', // Hans Memling — Portrait of a Man with an Arrow
        '50', // Gerard David — The Rest on the Flight into Egypt
        '51', // Rogier van der Weyden — Portrait of a Lady
        '54', // Anthony van Dyck — Isabella Brant
        '55', // Anthony van Dyck — Susanna Fourment and Her Daughter
        '60', // Johannes Vermeer — Girl with the Red Hat
        '63', // Pieter de Hooch — A Dutch Courtyard
        '64', // Gabriël Metsu — The Intruder
        '88', // Diego Velázquez — The Needlewoman
    ],
};

const SOURCES = {
    met: { id: 'metropolitan-museum-of-art', name: 'The Metropolitan Museum of Art', rights: 'The Met Open Access' },
    cleveland: { id: 'cleveland-museum-of-art', name: 'Cleveland Museum of Art', rights: 'Cleveland Museum of Art Open Access' },
    chicago: { id: 'art-institute-of-chicago', name: 'Art Institute of Chicago', rights: 'Art Institute of Chicago Public Domain' },
    rijksmuseum: { id: 'rijksmuseum', name: 'Rijksmuseum', rights: 'Public Domain / CC0' },
    paris: { id: 'paris-musees', name: 'Paris Musées', rights: 'CC0 / Paris Musées Open Content' },
    nga: { id: 'national-gallery-of-art', name: 'National Gallery of Art', rights: 'National Gallery of Art Open Access' },
};

const ARTIST_OVERRIDES = {
    'Rembrandt Rembrandt van Rijn': 'Rembrandt van Rijn',
    'Rembrandt': 'Rembrandt van Rijn',
    'Gabril Metsu': 'Gabriël Metsu',
    'Gabriel Metsu': 'Gabriël Metsu',
    'Velzquez': 'Diego Velázquez',
    'Velzquez Diego Rodrguez de Silva y Velzquez': 'Diego Velázquez',
    'Sir Anthony van Dyck': 'Anthony van Dyck',
    'Paul Czanne': 'Paul Cézanne',
    'Jean-Franois Millet': 'Jean-François Millet',
    'Edouard Manet': 'Édouard Manet',
    'Auguste Renoir': 'Pierre-Auguste Renoir',
    'Veronese': 'Paolo Veronese',
    'Antonio Canaletto': 'Canaletto',
};

const TITLE_OVERRIDES = {
    'met_local_jp7i86yqf': 'Circus Sideshow (Parade de cirque)',
    'met_local_q56t3j6af': 'James Stuart, Duke of Richmond and Lennox',
    'met_local_oh5f2i89d': 'Hendrickje Stoffels',
    'met_local_c3l6ho3w6': 'Mariana of Austria, Queen of Spain',
    'met_local_d88lbo815': 'Juan de Pareja',
    'met_local_4o4414qu0': 'La Berceuse (Woman Rocking a Cradle)',
    'met_local_5a3lrn055': 'First Steps, after Millet',
    'met_local_es06239u3': 'Haystacks: Autumn',
    'met_11936': 'The Old Mill (Vieux Moulin)',
    'met_local_9t6wmr7et': 'Haystacks, Morning, Éragny',
    'met_local_uwncytfyl': 'Kameyama: Clear Weather After Snow',
    'met_local_us9xe6rkx': "Christ's Descent into Hell",
    '142373354': 'Assumption of the Virgin',
    '141023057': 'Portrait of Charles Deering',
    '164503289': 'Head of a Damned Soul from Dante\'s "Inferno"',
    '125332959': 'War',
    '195574855': 'Young Bull',
    '131583': 'The Feast of Herod',
    '151881110': 'Two Children with a Cat',
    '198427750': 'Portrait of Napoleon I',
};

function cleanArtistName(rawArtist, fallback) {
    let artist = String(rawArtist || fallback || '').trim();
    // Strip parenthetical nationality / life dates from Cleveland records, e.g. "Claude Monet (French, 1840–1926)"
    artist = artist.replace(/\s*\([^)]*\).*$/, '').trim();
    return ARTIST_OVERRIDES[artist] || artist;
}

function cleanTitle(id, rawTitle) {
    if (TITLE_OVERRIDES[String(id)]) return TITLE_OVERRIDES[String(id)];
    let title = String(rawTitle || '').split('\n')[0].trim();
    title = title.replace(/\s*(?:title|label)\s+QS:.*$/i, '').trim();
    return title;
}

const snapshotPath = (sourceId, page) => sourceId === 'national-gallery-of-art'
    ? path.join(ROOT, 'public/museum-data/nga', `${page}.json`)
    : path.join(ROOT, 'public/museum-data', sourceId, `${page}.json`);

async function loadSnapshots(sourceId, pages) {
    const records = await Promise.all(pages.map(async page => {
        const payload = JSON.parse(await fs.readFile(snapshotPath(sourceId, page), 'utf8'));
        return payload.artworks || [];
    }));
    return records.flat();
}

const metDims = JSON.parse(await fs.readFile(MET_DIMS_PATH, 'utf8'));

function normalise(record, source) {
    const dimEntry = metDims[record.id];
    const imageWidth = Number(record.imageWidth || dimEntry?.width) || null;
    const imageHeight = Number(record.imageHeight || dimEntry?.height) || null;
    const orientation = record.orientation || (
        imageWidth && imageHeight
            ? (imageWidth > imageHeight ? 'landscape' : imageWidth < imageHeight ? 'portrait' : 'square')
            : null
    );
    return {
        id: `historic-${source.id}-${record.id}`,
        title: cleanTitle(record.id, record.title),
        artist: cleanArtistName(record.artist, source.name),
        image: record.image,
        fullRes: record.fullRes || record.image,
        imageWidth,
        imageHeight,
        orientation,
        rights: record.rights || source.rights,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: record.sourceUrl || null,
    };
}

function select(records, ids, source) {
    const byId = new Map();
    for (const record of records) {
        if (!byId.has(String(record.id))) byId.set(String(record.id), record);
    }
    return ids.map(id => {
        const record = byId.get(String(id));
        if (!record) throw new Error(`Missing curated artwork ${id} from ${source.name}.`);
        if (!record.image) throw new Error(`Curated artwork ${id} from ${source.name} has no image.`);
        return normalise(record, source);
    });
}

const metRecords = Object.values(MET_LOCAL_COLLECTIONS).flat();
const clevelandRecords = await loadSnapshots('cleveland-museum-of-art', [1, 2, 3]);
const chicagoRecords = await loadSnapshots('art-institute-of-chicago', [1, 2]);
const rijksmuseumRecords = await loadSnapshots('rijksmuseum', [1]);
const parisRecords = await loadSnapshots('paris-musees', [1]);
const ngaRecords = await loadSnapshots('national-gallery-of-art', [1, 2, 3, 4]);

const artworks = [
    ...select(metRecords, SELECTION.met, SOURCES.met),
    ...select(clevelandRecords, SELECTION.cleveland, SOURCES.cleveland),
    ...select(chicagoRecords, SELECTION.chicago, SOURCES.chicago),
    ...select(rijksmuseumRecords, SELECTION.rijksmuseum, SOURCES.rijksmuseum),
    ...select(parisRecords, SELECTION.paris, SOURCES.paris),
    ...select(ngaRecords, SELECTION.nga, SOURCES.nga),
];

if (artworks.length !== 100) throw new Error(`Expected 100 artworks, received ${artworks.length}.`);
if (new Set(artworks.map(artwork => artwork.id)).size !== artworks.length) throw new Error('The selection contains duplicate artworks.');

await fs.writeFile(OUTPUT, `${JSON.stringify(artworks, null, 2)}\n`, 'utf8');

const searchIndex = artworks.map(item => ({
    id: item.id,
    title: item.title,
    artist: item.artist,
    image: item.image,
    fullRes: item.fullRes,
    imageWidth: item.imageWidth,
    imageHeight: item.imageHeight,
    sourceName: item.sourceName,
}));
await fs.writeFile(SEARCH_INDEX_OUTPUT, `${JSON.stringify(searchIndex, null, 2)}\n`, 'utf8');

console.log(`Wrote ${artworks.length} historic masterpieces to ${path.relative(ROOT, OUTPUT)} and ${path.relative(ROOT, SEARCH_INDEX_OUTPUT)}.`);
