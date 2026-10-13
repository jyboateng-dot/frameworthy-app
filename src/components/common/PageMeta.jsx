import { useEffect } from 'react';

// This is a client-rendered SPA with no server-side rendering, so
// index.html's own <title>/<meta description>/OG tags are what a
// crawler that doesn't run JS (or a share-preview bot) sees — this
// component is what updates them for a real browser once a specific
// page has mounted, so the browser tab, bookmark, and (for anything
// that does execute JS, including Google's own crawler) search result
// reflect the actual page rather than one generic site-wide default.
// No react-helmet dependency — this app already favors small hand-built
// solutions over a library for something this simple.
const SITE_NAME = 'FrameWorthy';

const PageMeta = ({ title, description }) => {
    useEffect(() => {
        const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Made-to-Order Frames & Canvas`;
        document.title = fullTitle;

        const setMeta = (selector, attr, value) => {
            if (!value) return;
            let el = document.querySelector(selector);
            if (!el) {
                el = document.createElement('meta');
                const [, attrName, attrValue] = selector.match(/\[(\w+)="([^"]+)"\]/);
                el.setAttribute(attrName, attrValue);
                document.head.appendChild(el);
            }
            el.setAttribute(attr, value);
        };

        if (description) {
            setMeta('meta[name="description"]', 'content', description);
            setMeta('meta[property="og:description"]', 'content', description);
            setMeta('meta[name="twitter:description"]', 'content', description);
        }
        setMeta('meta[property="og:title"]', 'content', fullTitle);
        setMeta('meta[name="twitter:title"]', 'content', fullTitle);
    }, [title, description]);

    return null;
};

export default PageMeta;
