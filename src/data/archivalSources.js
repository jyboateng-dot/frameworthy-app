/** Public archival feeds that complement the museum collections. */
export const ARCHIVAL_SOURCES = [
    {
        id: 'biodiversity-heritage-library',
        name: 'Biodiversity Heritage Library',
        shortName: 'BHL',
        rights: 'Item-level rights; verify the source record before commercial use',
        access: 'Flickr public feed; BHL API key for deeper metadata',
        description: 'Botanical, ornithological, and natural-history plates from the Biodiversity Heritage Library.',
        apiUrl: 'https://www.biodiversitylibrary.org/docs/api3.html',
        collectionUrl: 'https://www.flickr.com/photos/biodivlibrary/',
    },
    {
        id: 'library-of-congress',
        name: 'Library of Congress',
        shortName: 'Library of Congress',
        rights: 'Free to Use and Reuse; confirm the item record',
        access: 'Unauthenticated JSON API',
        description: 'Maps, historic posters, patent illustrations, and city views from the Library of Congress.',
        apiUrl: 'https://www.loc.gov/apis/json-and-yaml/',
        collectionUrl: 'https://www.loc.gov/free-to-use/',
    },
    {
        id: 'nasa-open-media',
        name: 'NASA Open Media',
        shortName: 'NASA',
        rights: 'NASA media with item-level usage guidance',
        access: 'Unauthenticated Image and Video Library API',
        description: 'Space photography, telescope imagery, and NASA/JPL archival visuals.',
        apiUrl: 'https://images.nasa.gov/docs/images.nasa.gov_api_docs.pdf',
        collectionUrl: 'https://images.nasa.gov/',
    },
];

export const archivalSourceById = (sourceId) => ARCHIVAL_SOURCES.find(source => source.id === sourceId) || null;
