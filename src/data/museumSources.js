/**
 * Public museum sources that can supply artwork to the Inspiration catalogue.
 * Keep the source metadata separate from the artwork records so each source
 * can become its own category without coupling the UI to an API response.
 */
export const MUSEUM_SOURCES = [
    {
        id: 'metropolitan-museum-of-art',
        name: 'The Metropolitan Museum of Art',
        shortName: 'The Met',
        rights: 'Public domain and Open Access assets',
        access: 'Unauthenticated API',
        description: 'Search The Met collection and use public-domain works with primary image files.',
        apiUrl: 'https://metmuseum.github.io/',
        collectionUrl: 'https://www.metmuseum.org/art/collection',
    },
    {
        id: 'cleveland-museum-of-art',
        name: 'Cleveland Museum of Art',
        shortName: 'Cleveland Museum of Art',
        rights: 'CC0 Open Access images and data',
        access: 'Unauthenticated API',
        description: 'Browse Open Access collection records and high-resolution images cleared for reuse.',
        apiUrl: 'https://openaccess-api.clevelandart.org/',
        collectionUrl: 'https://www.clevelandart.org/open-access',
    },
    {
        id: 'national-gallery-of-art',
        name: 'National Gallery of Art',
        shortName: 'National Gallery of Art',
        rights: 'Open Data and Open Access images',
        access: 'Unauthenticated API',
        description: 'Browse classical European and American works with open metadata and IIIF delivery.',
        apiUrl: 'https://www.nga.gov/open-access-images.html',
        collectionUrl: 'https://www.nga.gov/collection.html',
    },
    {
        id: 'art-institute-of-chicago',
        name: 'Art Institute of Chicago',
        shortName: 'Art Institute of Chicago',
        rights: 'Public-domain works and IIIF images',
        access: 'Public API with rate limits',
        description: 'Use the public collection API, public-domain filter, and IIIF image services.',
        apiUrl: 'https://api.artic.edu/docs/',
        collectionUrl: 'https://www.artic.edu/collection',
    },
    {
        id: 'rijksmuseum',
        name: 'Rijksmuseum',
        shortName: 'Rijksmuseum',
        rights: 'CC0, CC BY, and other item-level rights',
        access: 'Public API (no key for the image-search endpoint)',
        description: 'Search Rijksmuseum records and high-resolution images while respecting item-level rights.',
        apiUrl: 'https://data.rijksmuseum.nl/',
        collectionUrl: 'https://www.rijksmuseum.nl/en/collection',
    },
    {
        id: 'smithsonian-open-access',
        name: 'Smithsonian Open Access',
        shortName: 'Smithsonian Open Access',
        rights: 'CC0-marked assets and open metadata',
        access: 'Public API (API key required)',
        description: 'Explore Smithsonian Open Access records and use assets marked for unrestricted reuse.',
        apiUrl: 'https://www.si.edu/openaccess/developers',
        collectionUrl: 'https://www.si.edu/openaccess',
    },
    {
        id: 'paris-musees',
        name: 'Paris Musées',
        shortName: 'Paris Musées',
        rights: 'Open collection assets with item-level rights',
        access: 'Free portal access',
        description: 'Explore collections from fourteen Paris museums, including historic art and posters.',
        apiUrl: 'https://www.parismuseescollections.paris.fr/en',
        collectionUrl: 'https://www.parismuseescollections.paris.fr/en',
    },
];

export const museumSourceById = (sourceId) => MUSEUM_SOURCES.find(source => source.id === sourceId) || null;
