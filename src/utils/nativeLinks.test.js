import { describe, expect, it } from 'vitest';
import { routeFromAppLink } from './nativeLinks';

describe('routeFromAppLink', () => {
    it('maps FrameWorthy links to React Router destinations', () => {
        expect(routeFromAppLink('https://frameworthyco.com/orders?order=123#status'))
            .toBe('/orders?order=123#status');
        expect(routeFromAppLink('https://www.frameworthyco.com/'))
            .toBe('/');
    });

    it('rejects external hosts, insecure links, and malformed values', () => {
        expect(routeFromAppLink('https://evil.example/orders')).toBeNull();
        expect(routeFromAppLink('https://frameworthyco.com.evil.example/orders')).toBeNull();
        expect(routeFromAppLink('http://frameworthyco.com/orders')).toBeNull();
        expect(routeFromAppLink('not-a-url')).toBeNull();
        expect(routeFromAppLink(null)).toBeNull();
    });
});
