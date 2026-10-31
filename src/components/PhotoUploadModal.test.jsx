import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PhotoUploadModal from './PhotoUploadModal';
import * as artworkImport from '../services/artworkImport';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('PhotoUploadModal', () => {
    it('does not render when isOpen is false', () => {
        render(<PhotoUploadModal isOpen={false} onClose={vi.fn()} />);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal dialog when isOpen is true', () => {
        render(<PhotoUploadModal isOpen={true} onClose={vi.fn()} />);
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: /Upload your photo or artwork/i })).toBeInTheDocument();
        expect(screen.getByText(/Choose a photo from your device/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Browse photos/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Google Drive/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Dropbox/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Paste image link/i })).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<PhotoUploadModal isOpen={true} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: /Close photo upload dialog/i }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when Escape key is pressed', () => {
        const onClose = vi.fn();
        render(<PhotoUploadModal isOpen={true} onClose={onClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('processes selected device image file and navigates to customize', async () => {
        const onClose = vi.fn();
        const navigate = vi.fn();
        const fakeFile = new File(['dummy content'], 'family-holiday.jpg', { type: 'image/jpeg' });
        
        vi.spyOn(artworkImport, 'importArtworkFromDevice').mockResolvedValue({
            file: fakeFile,
            source: 'device',
            name: 'family-holiday.jpg',
            mimeType: 'image/jpeg',
        });

        // Mock URL.createObjectURL
        const createObjectURLMock = vi.fn().mockReturnValue('blob:http://localhost/mock-blob-uuid');
        window.URL.createObjectURL = createObjectURLMock;

        render(<PhotoUploadModal isOpen={true} onClose={onClose} navigate={navigate} />);

        const fileInput = document.getElementById('photo-upload-file-input');
        expect(fileInput).toBeInTheDocument();

        fireEvent.change(fileInput, { target: { files: [fakeFile] } });

        await waitFor(() => {
            expect(artworkImport.importArtworkFromDevice).toHaveBeenCalledWith(fakeFile);
            expect(onClose).toHaveBeenCalled();
            expect(navigate).toHaveBeenCalledWith('/frame/customize', {
                state: expect.objectContaining({
                    uploadedFile: fakeFile,
                    presetTitle: 'family-holiday',
                    presetImage: 'blob:http://localhost/mock-blob-uuid',
                }),
            });
        });
    });

    it('shows error banner when device import throws an error', async () => {
        vi.spyOn(artworkImport, 'importArtworkFromDevice').mockRejectedValue(new Error('Choose an image smaller than 20 MB.'));

        const fakeLargeFile = new File(['content'], 'huge.jpg', { type: 'image/jpeg' });
        render(<PhotoUploadModal isOpen={true} onClose={vi.fn()} />);

        const fileInput = document.getElementById('photo-upload-file-input');
        fireEvent.change(fileInput, { target: { files: [fakeLargeFile] } });

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent('Choose an image smaller than 20 MB.');
        });
    });

    it('allows toggling URL import and submitting a valid image link', async () => {
        const onClose = vi.fn();
        const onStartFraming = vi.fn();
        const fakeFile = new File(['content'], 'downloaded-art.png', { type: 'image/png' });

        vi.spyOn(artworkImport, 'importArtworkFromUrl').mockResolvedValue({
            file: fakeFile,
            source: 'url',
            name: 'downloaded-art.png',
            mimeType: 'image/png',
        });

        window.URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost/mock-url-blob');

        render(<PhotoUploadModal isOpen={true} onClose={onClose} onStartFraming={onStartFraming} />);

        // Toggle URL input
        fireEvent.click(screen.getByRole('button', { name: /Paste image link/i }));
        expect(screen.getByLabelText(/Direct image URL/i)).toBeInTheDocument();

        // Type URL and submit
        const urlInput = screen.getByLabelText(/Direct image URL/i);
        fireEvent.change(urlInput, { target: { value: 'https://example.com/art.png' } });
        fireEvent.click(screen.getByRole('button', { name: /Import/i }));

        await waitFor(() => {
            expect(artworkImport.importArtworkFromUrl).toHaveBeenCalledWith('https://example.com/art.png');
            expect(onClose).toHaveBeenCalled();
            expect(onStartFraming).toHaveBeenCalledWith(expect.objectContaining({
                uploadedFile: fakeFile,
                presetTitle: 'downloaded-art',
            }));
        });
    });

    it('displays configuration guidance when clicking Google Drive without API credentials', async () => {
        render(<PhotoUploadModal isOpen={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Google Drive/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Google Drive is not configured yet/i);
        });
    });

    it('displays configuration guidance when clicking Dropbox without API credentials', async () => {
        render(<PhotoUploadModal isOpen={true} onClose={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /Dropbox/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toHaveTextContent(/Dropbox is not configured yet/i);
        });
    });
});
