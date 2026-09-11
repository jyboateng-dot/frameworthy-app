import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArtworkImportMenu from './ArtworkImportMenu';
import { importArtworkFromCloud, importArtworkFromUrl } from '../../services/artworkImport';

vi.mock('../../services/artworkImport', () => ({
    ARTWORK_IMPORT_SOURCES: {
        drive: { label: 'Google Drive', available: true },
        dropbox: { label: 'Dropbox', available: false },
    },
    importArtworkFromCloud: vi.fn(),
    importArtworkFromDevice: vi.fn(),
    importArtworkFromUrl: vi.fn(),
    preloadArtworkCloudPickers: vi.fn().mockResolvedValue([]),
}));

describe('ArtworkImportMenu', () => {
    beforeEach(() => vi.clearAllMocks());

    it('shows configured sources and imports a pasted image link', async () => {
        const file = new File(['pixels'], 'linked.png', { type: 'image/png' });
        const onFile = vi.fn();
        importArtworkFromUrl.mockResolvedValue({ file, source: 'url', name: file.name, mimeType: file.type });
        render(<ArtworkImportMenu isPlaceholder onFile={onFile} />);

        fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
        expect(screen.getByRole('menuitem', { name: 'Google Drive' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Dropbox' })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('menuitem', { name: 'Paste image link' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Image URL' }), {
            target: { value: 'https://example.com/linked.png' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Import image from link' }));

        await waitFor(() => expect(onFile).toHaveBeenCalledWith(file));
        expect(importArtworkFromUrl).toHaveBeenCalledWith('https://example.com/linked.png');
    });

    it('keeps the link panel open and displays import errors', async () => {
        importArtworkFromUrl.mockRejectedValue(new Error('That link does not point to a supported image.'));
        render(<ArtworkImportMenu isPlaceholder onFile={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Paste image link' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Image URL' }), {
            target: { value: 'https://example.com/page' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Import image from link' }));

        expect(await screen.findByRole('alert')).toHaveTextContent('supported image');
        expect(screen.getByRole('textbox', { name: 'Image URL' })).toBeInTheDocument();
    });

    it('closes the menu when the device picker is cancelled', () => {
        const { container } = render(<ArtworkImportMenu isPlaceholder onFile={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
        fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [] } });

        expect(screen.queryByRole('menuitem', { name: 'Google Drive' })).not.toBeInTheDocument();
    });

    it('closes the menu when a cloud picker is cancelled', async () => {
        importArtworkFromCloud.mockRejectedValue(new Error('No image was selected.'));
        render(<ArtworkImportMenu isPlaceholder onFile={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
        fireEvent.click(screen.getByRole('menuitem', { name: 'Google Drive' }));

        await waitFor(() => {
            expect(screen.queryByRole('menuitem', { name: 'Google Drive' })).not.toBeInTheDocument();
        });
    });

    it('keeps the source menu anchored to the upload control on small screens', () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
        const { container, unmount } = render(<ArtworkImportMenu isPlaceholder onFile={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: 'Upload Image' }));
        const menu = screen.getByRole('menu');
        expect(menu.parentElement?.parentElement).toBe(container.firstChild);
        expect(screen.queryByRole('button', { name: 'Close image sources' })).not.toBeInTheDocument();

        unmount();
        window.matchMedia = originalMatchMedia;
    });
});
