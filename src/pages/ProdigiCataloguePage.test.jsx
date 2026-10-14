import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ProdigiCataloguePage from './ProdigiCataloguePage';

afterEach(cleanup);

const renderCatalogue = () => render(<MemoryRouter><ProdigiCataloguePage /></MemoryRouter>);

describe('ProdigiCataloguePage', () => {
    it('shows a live supplier-cost breakdown for Jersey and switches to UK availability', async () => {
        const user = userEvent.setup();
        renderCatalogue();

        expect(screen.getByRole('heading', { name: 'Frame & canvas catalogue' })).toBeInTheDocument();
        expect(screen.getAllByRole('heading', { name: 'Box frame · no mount' })).toHaveLength(2);
        expect(screen.getByText('Supplier subtotal*')).toBeInTheDocument();
        expect(screen.getByText(/Standard shipping: .* days, tracked/i)).toBeInTheDocument();

        await user.selectOptions(screen.getByLabelText('Shipping to'), 'GB');
        expect(screen.getByLabelText('Shipping to')).toHaveValue('GB');
        expect(screen.getByText(/Listed currency is shown/)).toBeInTheDocument();
        expect(screen.queryByText(/Prodigi/i)).not.toBeInTheDocument();
    });

    it('exposes the sourced mounted box and canvas wrap choices', async () => {
        const user = userEvent.setup();
        renderCatalogue();

        await user.click(screen.getByRole('button', { name: /Box frame · mounted/ }));
        expect(screen.getByText(/Mount: 2.4mm, Snow white/)).toBeInTheDocument();

        await user.click(screen.getAllByRole('button', { name: /Float-framed canvas · 38 mm/ })[0]);
        expect(screen.getAllByRole('heading', { name: 'Float-framed canvas · 38 mm' })).toHaveLength(2);
        expect(screen.getByRole('group', { name: 'Canvas edge finish' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Image wrap' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('shows product photos, colour-specific finish thumbnails and sourced dimensions', async () => {
        const user = userEvent.setup();
        renderCatalogue();

        expect(screen.getByRole('heading', { name: 'Product specifications' })).toBeInTheDocument();
        expect(screen.getByText('Depth from wall')).toBeInTheDocument();
        expect(screen.getByText('33 mm')).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /natural finish — frame finish detail/i }))
            .toHaveAttribute('src', '/prodigi/finishes/box-natural.png');

        await user.click(screen.getByRole('button', { name: 'Show side profile' }));
        expect(screen.getByRole('img', { name: /side profile/i }))
            .toHaveAttribute('src', '/prodigi/views/box-profile.jpg');
    });

    it('shows the 38 mm stretched-canvas variants, four edge finishes, photography and product assets', async () => {
        const user = userEvent.setup();
        renderCatalogue();

        await user.click(screen.getByRole('button', { name: /Stretched canvas · 38 mm/ }));

        expect(screen.getByRole('group', { name: 'Canvas edge finish' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Image wrap' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Mirror wrap' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Black edge' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'White edge' })).toBeInTheDocument();
        expect(screen.getByRole('img', { name: /Stretched canvas · 38 mm — Product view/i }))
            .toHaveAttribute('src', '/prodigi/views/stretched-canvas-product.jpg');
        expect(screen.getByRole('button', { name: 'Show canvas texture' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Show blank canvas mockup' })).toBeInTheDocument();
        expect(within(screen.getByRole('group', { name: 'Frame visualizer views' })).getAllByRole('button')).toHaveLength(9);
        expect(screen.getByRole('link', { name: /Full product photography asset bundle/i }))
            .toHaveAttribute('href', expect.stringContaining('prodigi-stretched-canvas-photo-assets.zip'));
        expect(screen.getByRole('link', { name: /product sheet \(PDF\)/i })).toBeInTheDocument();
        expect(screen.getByText('Stretcher material')).toBeInTheDocument();
        expect(screen.getByText('European kiln-dried knotless pine')).toBeInTheDocument();
        expect(screen.getByText('Supplier subtotal*')).toBeInTheDocument();
    });
});
