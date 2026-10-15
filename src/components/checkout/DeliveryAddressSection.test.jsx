import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DeliveryAddressSection from './DeliveryAddressSection';

const blank = { fullName: 'Test Customer', line1: '', line2: '', city: '', stateOrCounty: '', postalOrZipCode: '' };
function Harness({ initial = blank, ...props }) {
    const [address, setAddress] = useState(initial);
    return <DeliveryAddressSection address={address} onChange={updates => setAddress(current => ({ ...current, ...updates }))} countryCode="GB" onCountryChange={vi.fn()} savedAddresses={[]} selectedAddressId="new" provider="ideal" {...props} />;
}

describe('simple delivery checkout', () => {
    it('offers manual entry immediately when no provider is connected', () => {
        render(<Harness lookupEnabled={false} />);
        expect(screen.queryByRole('button', { name: 'Find address' })).not.toBeInTheDocument();
        expect(screen.getByLabelText('House name or number and street')).toHaveAttribute('autocomplete', 'shipping address-line1');
        expect(screen.queryByLabelText('County (optional)')).not.toBeInTheDocument();
    });

    it('populates all address lines from lookup and shows a compact editable card', async () => {
        const user = userEvent.setup();
        const lookup = vi.fn().mockResolvedValue([{ id: '1', line1: '10 Test Street', line2: 'Flat 2, Test Building', city: 'London', stateOrCounty: '', postalOrZipCode: 'SW1A 1AA' }]);
        render(<Harness lookupEnabled lookup={lookup} />);
        await user.type(screen.getByLabelText('Postcode'), 'sw1a1aa');
        expect(screen.queryByRole('button', { name: 'Find address' })).not.toBeInTheDocument();
        await user.click(await screen.findByRole('option', { name: '10 Test Street, Flat 2, Test Building, London' }));
        expect(screen.getByText('Flat 2, Test Building')).toBeInTheDocument();
        expect(screen.getByText('SW1A 1AA')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Change address' }));
        await user.click(screen.getByRole('button', { name: 'Enter address manually' }));
        expect(screen.getByLabelText('House name or number and street')).toHaveValue('10 Test Street');
    });

    it('reveals manual fields when search fails', async () => {
        const user = userEvent.setup();
        render(<Harness lookupEnabled lookup={vi.fn().mockRejectedValue(new Error('offline'))} />);
        await user.type(screen.getByLabelText('Postcode'), 'SW1A 1AA');
        expect(await screen.findByRole('alert')).toHaveTextContent('enter your address manually');
        expect(screen.getByLabelText('Town or city')).toBeInTheDocument();
    });

    it('returns from manual entry to automatic postcode search', async () => {
        const user = userEvent.setup();
        const lookup = vi.fn().mockResolvedValue([{ id: '1', line1: '10 Test Street', line2: '', city: 'London', stateOrCounty: '', postalOrZipCode: 'SW1A 1AA' }]);
        render(<Harness lookupEnabled lookup={lookup} />);
        await user.click(screen.getByRole('button', { name: 'Enter address manually' }));
        expect(screen.getByLabelText('House name or number and street')).toBeInTheDocument();
        await user.type(screen.getByLabelText('Postcode'), 'SW1A1AA');
        await user.click(screen.getByRole('button', { name: 'Search by postcode instead' }));
        expect(screen.queryByLabelText('House name or number and street')).not.toBeInTheDocument();
        expect(await screen.findByRole('option', { name: '10 Test Street, London' })).toBeInTheDocument();
    });

    it('discards a slow lookup after postcode changes', async () => {
        const user = userEvent.setup();
        let resolve;
        const lookup = vi.fn().mockImplementation(() => new Promise(done => { resolve = done; }));
        render(<Harness lookupEnabled lookup={lookup} />);
        await user.type(screen.getByLabelText('Postcode'), 'SW1A 1AA');
        await waitFor(() => expect(lookup).toHaveBeenCalledTimes(1));
        fireEvent.change(screen.getByLabelText('Postcode'), { target: { value: 'EH1 1AA' } });
        resolve([{ id: 'old', line1: 'Wrong address' }]);
        await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Choose your address' })).not.toBeInTheDocument());
    });

    it('lets a returning customer keep their saved address without opening fields', () => {
        render(<Harness initial={{ ...blank, line1: '10 Test Street', city: 'London', postalOrZipCode: 'SW1A1AA' }} selectedAddressId="saved-1" lookupEnabled={false} />);
        expect(screen.getByText('10 Test Street')).toBeInTheDocument();
        expect(screen.queryByLabelText('House name or number and street')).not.toBeInTheDocument();
    });

    it('uses free-text search for Geoapify and keeps incomplete matches editable', async () => {
        const user = userEvent.setup();
        const lookup = vi.fn().mockResolvedValue([{ id: 'street', label: 'Test Street, London', line1: 'Test Street', line2: '', city: 'London', stateOrCounty: '', postalOrZipCode: '', requiresCompletion: true }]);
        render(<Harness provider="geoapify" lookupEnabled lookup={lookup} />);
        expect(screen.queryByLabelText('Postcode')).not.toBeInTheDocument();
        await user.type(screen.getByLabelText('Search your address'), 'Test Street');
        await user.click(screen.getByRole('button', { name: 'Search addresses' }));
        expect(lookup).toHaveBeenCalledWith('Test Street', 'GB', expect.objectContaining({ provider: 'geoapify' }));
        await user.click(await screen.findByRole('option', { name: 'Test Street, London' }));
        expect(screen.getByLabelText('House name or number and street')).toHaveValue('Test Street');
        expect(screen.getByLabelText('Postcode')).toHaveValue('');
        expect(screen.getByRole('status')).toHaveTextContent('house name');
        expect(screen.getByRole('link', { name: 'Powered by Geoapify' })).toHaveAttribute('href', 'https://www.geoapify.com/');
    });
});
