import { describe, expect, it } from 'vitest';
import { MUSEUM_SOURCES, museumSourceById } from './museumSources';

describe('museum source catalogue', () => {
    it('exposes one uniquely named category for each recommended source', () => {
        expect(MUSEUM_SOURCES).toHaveLength(7);
        expect(new Set(MUSEUM_SOURCES.map(source => source.id)).size).toBe(MUSEUM_SOURCES.length);
        expect(new Set(MUSEUM_SOURCES.map(source => source.name)).size).toBe(MUSEUM_SOURCES.length);
    });

    it('resolves source categories by id', () => {
        expect(museumSourceById('cleveland-museum-of-art').name).toBe('Cleveland Museum of Art');
        expect(museumSourceById('unknown-source')).toBeNull();
    });
});
