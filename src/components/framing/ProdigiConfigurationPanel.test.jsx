import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProdigiConfigurationPanel from './ProdigiConfigurationPanel';
import { FRAME_STYLES } from '../../data/constants';
import { prodigiAvailableSizes } from '../../utils/prodigiFlow';

vi.mock('../../services/prodigi', () => ({
    getProdigiQuote: vi.fn().mockResolvedValue({
        quotes: [
            {
                shippingMethod: 'Standard',
                total: { amount: 85, currency: 'GBP' },
                items: { amount: 65 },
                shipping: { amount: 10 },
                tax: { amount: 10 },
            },
        ],
    }),
    prodigiAttributesForProduct: vi.fn(() => ({})),
}));

describe('ProdigiConfigurationPanel', () => {
    const boxFrame = FRAME_STYLES.find((frame) => frame.id === 'prodigi-box-black');
    const boxSize = prodigiAvailableSizes(boxFrame).find((item) => item.prodigiSizeInches === '8x10"') || prodigiAvailableSizes(boxFrame)[0];

    it('renders successfully with default No Mount selection', () => {
        render(
            <ProdigiConfigurationPanel
                step="4"
                frame={boxFrame}
                size={boxSize}
                selection={null}
                onSelectionChange={vi.fn()}
                onVisualOptionsChange={vi.fn()}
            />
        );

        expect(screen.getByText('Mount')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Mount' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'No Mount' })).toBeInTheDocument();
        expect(screen.getAllByText('No Mount')).toHaveLength(2);
    });

    it('toggles Add Mount without crashing and displays the mount width label', () => {
        const onVisualOptionsChange = vi.fn();
        const onSelectionChange = vi.fn();

        render(
            <ProdigiConfigurationPanel
                step="4"
                frame={boxFrame}
                size={boxSize}
                selection={null}
                onSelectionChange={onSelectionChange}
                onVisualOptionsChange={onVisualOptionsChange}
            />
        );

        const addMountBtn = screen.getByRole('button', { name: 'Add Mount' });
        // Clicking "Add Mount" used to crash with ReferenceError: mountWidthLabel is not defined
        expect(() => fireEvent.click(addMountBtn)).not.toThrow();

        // Should now show mount colours and the calculated mount width label
        expect(screen.getByText('Mount Colour')).toBeInTheDocument();
        expect(screen.getByText('Mount width is set automatically for this frame size.')).toBeInTheDocument();

        // Clicking "No Mount" toggles back
        const noMountBtn = screen.getByRole('button', { name: 'No Mount' });
        expect(() => fireEvent.click(noMountBtn)).not.toThrow();
        expect(screen.queryByText('Mount Colour')).not.toBeInTheDocument();
    });

    it('displays "Live Item Price" in the green summary banner when a quote exists', () => {
        render(
            <ProdigiConfigurationPanel
                step="4"
                frame={boxFrame}
                size={boxSize}
                selection={{
                    productId: 'box-test',
                    quoteItemsGbp: 65,
                    quoteTotalGbp: 85,
                }}
                onSelectionChange={vi.fn()}
                onVisualOptionsChange={vi.fn()}
            />
        );

        expect(screen.getByText('Live Item Price')).toBeInTheDocument();
        expect(screen.getByText('Delivery & tax calculated at checkout')).toBeInTheDocument();
        expect(screen.getByText('£65.00')).toBeInTheDocument();
    });
});
