import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader, MapPin } from 'lucide-react';
import { deliveryCountryName, isValidDeliveryPostalCode, normalizePostalCode } from '../../utils/deliveryAddress';
import { getAddressLookupProvider, isAddressLookupConfigured, lookupDeliveryAddresses } from '../../services/addressLookup';

const inputClass = 'mt-1 w-full rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a84c]';

export default function DeliveryAddressSection({
    address, onChange, countryCode, onCountryChange, isUpdatingCountry, countryError,
    savedAddresses, selectedAddressId, onAddressSelect, isFetchingAddresses,
    lookupEnabled = isAddressLookupConfigured(), lookup = lookupDeliveryAddresses,
    provider = getAddressLookupProvider(),
}) {
    const [editing, setEditing] = useState(true);
    const [results, setResults] = useState([]);
    const [lookupError, setLookupError] = useState('');
    const [searching, setSearching] = useState(false);
    const [manual, setManual] = useState(false);
    const [moreFields, setMoreFields] = useState(false);
    const [countryOpen, setCountryOpen] = useState(false);
    const [postcodeTouched, setPostcodeTouched] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [needsCompletion, setNeedsCompletion] = useState(false);
    const [sourceAttributions, setSourceAttributions] = useState([]);
    const controller = useRef(null);
    const requestId = useRef(0);
    const hasCompleteAddress = Boolean(address.line1.trim() && address.city.trim() && isValidDeliveryPostalCode(countryCode, address.postalOrZipCode));
    const showCard = !editing && hasCompleteAddress;
    const postcodeInvalid = postcodeTouched && !isValidDeliveryPostalCode(countryCode, address.postalOrZipCode);
    const isGeoapify = provider === 'geoapify';
    const scope = `${countryCode}:${address.postalOrZipCode}:${searchQuery}`;
    useEffect(() => {
        if (selectedAddressId !== 'new' && selectedAddressId !== 'custom') setEditing(false);
    }, [selectedAddressId]);
    useEffect(() => {
        requestId.current += 1;
        controller.current?.abort();
        setResults([]);
        setLookupError('');
        setSearching(false);
        return () => controller.current?.abort();
    }, [scope]);

    const findAddress = useCallback(async (postcodeOverride = '') => {
        if (isGeoapify && searchQuery.trim().length < 3) {
            setLookupError('Enter a house name, street or postcode to search.');
            return;
        }
        const postcode = typeof postcodeOverride === 'string' && postcodeOverride
            ? postcodeOverride
            : address.postalOrZipCode;
        if (!isGeoapify && !isValidDeliveryPostalCode(countryCode, postcode)) {
            setLookupError(countryCode === 'JE' ? 'Enter a Jersey postcode, for example JE2 3AA.' : 'Enter a UK postcode, for example SW1A 1AA.');
            return;
        }
        controller.current?.abort();
        const current = ++requestId.current;
        const activeController = new AbortController();
        controller.current = activeController;
        const timeout = setTimeout(() => activeController.abort(), 10000);
        setSearching(true);
        setLookupError('');
        setResults([]);
        try {
            const addresses = await lookup(isGeoapify ? searchQuery : postcode, countryCode, { signal: activeController.signal, provider });
            if (current !== requestId.current) return;
            setResults(addresses);
            setSourceAttributions([...new Set(addresses.map(result => result.attribution).filter(Boolean))]);
            if (!addresses.length) {
                setLookupError('No addresses found. You can enter yours manually.');
                setManual(true);
            }
        } catch {
            if (current === requestId.current) {
                setLookupError('Address search is unavailable. Please enter your address manually.');
                setManual(true);
            }
        } finally {
            clearTimeout(timeout);
            if (current === requestId.current) setSearching(false);
        }
    }, [address.postalOrZipCode, countryCode, isGeoapify, lookup, provider, searchQuery]);
    useEffect(() => {
        if (!lookupEnabled || isGeoapify || manual || isUpdatingCountry) return undefined;
        const postcode = normalizePostalCode(address.postalOrZipCode);
        if (!isValidDeliveryPostalCode(countryCode, postcode)) return undefined;
        const timer = setTimeout(() => findAddress(postcode), 400);
        return () => clearTimeout(timer);
    }, [address.postalOrZipCode, countryCode, findAddress, isGeoapify, isUpdatingCountry, lookupEnabled, manual]);
    const selectResult = (resultId) => {
        const selected = results.find(result => result.id === resultId);
        if (!selected) return;
        onChange({ ...selected });
        setResults([]);
        setEditing(Boolean(selected.requiresCompletion));
        setManual(Boolean(selected.requiresCompletion));
        setNeedsCompletion(Boolean(selected.requiresCompletion));
    };
    const field = (name, label, autoComplete, required = false, placeholder = '') => (
        <label className="block text-xs font-medium text-stone-700">
            {label}
            <input name={name} autoComplete={`shipping ${autoComplete}`} required={required} value={address[name]} onChange={event => onChange({ [name]: event.target.value })} placeholder={placeholder} className={inputClass} />
        </label>
    );

    return (
        <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5" aria-labelledby="delivery-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
                <h2 id="delivery-heading" className="flex items-center gap-2 text-sm font-bold"><MapPin size={17} /> Deliver to</h2>
                {isFetchingAddresses && <Loader size={16} className="animate-spin" aria-label="Loading saved addresses" />}
                {showCard && <button type="button" onClick={() => setEditing(true)} className="text-sm underline underline-offset-4">Change address</button>}
            </div>
            <div className="mb-4 flex items-center gap-3 text-sm">
                {countryOpen ? <label className="flex flex-1 items-center gap-3">Country
                    <select aria-label="Delivery country" value={countryCode} disabled={isUpdatingCountry} onChange={event => { onCountryChange(event.target.value); setCountryOpen(false); }} className="rounded-lg border border-stone-200 px-3 py-2">
                        <option value="GB">United Kingdom</option><option value="JE">Jersey</option>
                    </select>
                </label> : <><span>{deliveryCountryName(countryCode)}</span><button type="button" disabled={isUpdatingCountry} onClick={() => setCountryOpen(true)} className="text-xs text-stone-500 underline underline-offset-4">Change country</button></>}
                {isUpdatingCountry && <span role="status" className="text-xs text-stone-500">Updating delivery price…</span>}
            </div>
            {countryError && <p role="alert" className="mb-3 text-sm text-red-700">{countryError}</p>}
            {showCard ? <address className="text-sm not-italic leading-6 text-stone-700">
                <span className="block font-semibold text-stone-900">{address.fullName}</span>
                <span className="block">{address.line1}</span>
                {address.line2 && <span className="block">{address.line2}</span>}
                <span className="block">{address.city}</span>
                {address.stateOrCounty && <span className="block">{address.stateOrCounty}</span>}
                <span className="block">{normalizePostalCode(address.postalOrZipCode)}</span>
            </address> : <div className="space-y-3">
                {savedAddresses.length > 0 && <label className="block text-xs font-medium text-stone-700">Saved address
                    <select aria-label="Saved address" value={selectedAddressId} onChange={event => { onAddressSelect(event); setEditing(event.target.value === 'new'); }} className={inputClass}>
                        <option value="new">Enter a new address</option>
                        {selectedAddressId === 'custom' && <option value="custom">Current address</option>}
                        {savedAddresses.map(saved => <option key={saved.id} value={saved.id}>{saved.deliveryAddress}, {saved.postalOrZipCode}</option>)}
                    </select>
                </label>}
                {lookupEnabled && isGeoapify && <div>
                    <label className="block text-xs font-medium text-stone-700">Search your address
                        <input name="address-search" autoComplete="off" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); findAddress(); } }} placeholder="House name, street or postcode" className={inputClass} />
                    </label>
                    <button type="button" onClick={findAddress} disabled={searching || isUpdatingCountry} className="mt-2 rounded-lg bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{searching ? 'Searching…' : 'Search addresses'}</button>
                </div>}
                {(!lookupEnabled || !isGeoapify || manual) && <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs font-medium text-stone-700">Postcode
                        <input name="postalOrZipCode" autoComplete="shipping postal-code" autoCapitalize="characters" required value={address.postalOrZipCode} aria-invalid={postcodeInvalid} aria-describedby={postcodeInvalid ? 'checkout-postcode-error' : undefined} onBlur={() => { setPostcodeTouched(true); if (isValidDeliveryPostalCode(countryCode, address.postalOrZipCode)) onChange({ postalOrZipCode: normalizePostalCode(address.postalOrZipCode) }); }} onChange={event => { const value = event.target.value; onChange({ postalOrZipCode: isValidDeliveryPostalCode(countryCode, value) ? normalizePostalCode(value) : value }); }} placeholder={countryCode === 'JE' ? 'JE2 3AA' : 'SW1A 1AA'} className={`${inputClass} uppercase`} />
                    </label>
                    {lookupEnabled && !isGeoapify && searching && <span role="status" className="shrink-0 pb-3 text-xs text-stone-500">Finding…</span>}
                </div>}
                {postcodeInvalid && (!lookupEnabled || !isGeoapify || manual) && <p id="checkout-postcode-error" className="text-xs text-red-700">{countryCode === 'JE' ? 'Enter a Jersey postcode, starting with JE.' : 'Enter a UK postcode. For a Jersey address, change the country to Jersey.'}</p>}
                {lookupError && <p role="alert" className="text-sm text-stone-600">{lookupError}</p>}
                {results.length > 0 && <div className="block text-xs font-medium text-stone-700">
                    <span id="address-results-label">Choose your address</span>
                    <div role="listbox" aria-labelledby="address-results-label" className="mt-1 max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white p-1 shadow-lg">
                        {results.map(result => {
                            const label = result.label || [result.line1, result.line2, result.city].filter(Boolean).join(', ');
                            return <button key={result.id} type="button" role="option" aria-selected="false" onClick={() => selectResult(result.id)} className="block w-full rounded-md px-3 py-2.5 text-left text-sm font-normal text-stone-800 hover:bg-stone-100 focus:bg-stone-100 focus:outline-none">{label}</button>;
                        })}
                    </div>
                </div>}
                {lookupEnabled && !manual && <button type="button" onClick={() => setManual(true)} className="text-xs text-stone-600 underline underline-offset-4">Enter address manually</button>}
                {(!lookupEnabled || manual) && <>
                    {lookupEnabled && manual && <button type="button" onClick={() => { setManual(false); setLookupError(''); setNeedsCompletion(false); }} className="text-xs text-stone-600 underline underline-offset-4">Search by postcode instead</button>}
                    {needsCompletion && <p role="status" className="text-xs text-stone-600">Please add or check your house name, number, flat and postcode before using this address.</p>}
                    {field('line1', 'House name or number and street', 'address-line1', true)}
                    {field('city', 'Town or city', 'address-level2', true, countryCode === 'JE' ? 'Jersey' : '')}
                    {(moreFields || address.line2 || address.stateOrCounty) ? <>
                        {field('line2', 'Flat, building or locality (optional)', 'address-line2')}
                        {field('stateOrCounty', countryCode === 'JE' ? 'Parish (optional)' : 'County (optional)', 'address-level1')}
                    </> : <button type="button" onClick={() => setMoreFields(true)} className="text-xs text-stone-600 underline underline-offset-4">Add flat, building or locality</button>}
                    {editing && hasCompleteAddress && <button type="button" onClick={() => setEditing(false)} className="block rounded-lg bg-stone-900 px-4 py-2 text-sm font-semibold text-white">Use this address</button>}
                </>}
            </div>}
            {lookupEnabled && isGeoapify && <div className="mt-3 text-[10px] leading-4 text-stone-500">
                <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer" className="underline">Powered by Geoapify</a>
                {' · '}<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">© OpenStreetMap contributors</a>
                {sourceAttributions.filter(source => source !== '© OpenStreetMap contributors').map(source => <span key={source} className="block">{source}</span>)}
            </div>}
        </section>
    );
}
