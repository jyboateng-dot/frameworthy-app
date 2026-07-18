import { describe, it, expect, beforeEach } from 'vitest';
import admin from 'firebase-admin';
import { redeemTesterPin } from '../index.js';
import { clearFirestore } from './helpers.js';

const db = () => admin.firestore();

beforeEach(async () => {
    await clearFirestore();
});

describe('redeemTesterPin', () => {
    it('rejects a call missing pin or name', async () => {
        await expect(redeemTesterPin.run({ data: { name: 'Ama' } })).rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(redeemTesterPin.run({ data: { pin: 'ABCDE' } })).rejects.toMatchObject({ code: 'invalid-argument' });
        await expect(redeemTesterPin.run({ data: { pin: 'ABCDE', name: '   ' } })).rejects.toMatchObject({ code: 'invalid-argument' });
    });

    it('returns invalid for a pin that was never issued', async () => {
        const result = await redeemTesterPin.run({ data: { pin: 'NOTREAL', name: 'Ama' } });
        expect(result).toEqual({ success: false, reason: 'invalid' });
    });

    it('redeems an unused pin, recording who claimed it', async () => {
        await db().collection('testerPins').doc('ABCDE').set({ used: false });

        const result = await redeemTesterPin.run({ data: { pin: 'abcde', name: '  Ama Boateng  ' } });
        expect(result).toEqual({ success: true });

        const pin = (await db().collection('testerPins').doc('ABCDE').get()).data();
        expect(pin.used).toBe(true);
        expect(pin.usedByName).toBe('Ama Boateng');
        expect(pin.usedAt).toBeTruthy();
    });

    it('rejects redeeming a pin that was already used', async () => {
        await db().collection('testerPins').doc('ABCDE').set({ used: true, usedByName: 'First Person' });

        const result = await redeemTesterPin.run({ data: { pin: 'ABCDE', name: 'Second Person' } });
        expect(result).toEqual({ success: false, reason: 'used' });

        const pin = (await db().collection('testerPins').doc('ABCDE').get()).data();
        expect(pin.usedByName).toBe('First Person'); // untouched
    });

    it('a second redemption attempt after a successful one is rejected as used', async () => {
        await db().collection('testerPins').doc('ABCDE').set({ used: false });

        const first = await redeemTesterPin.run({ data: { pin: 'ABCDE', name: 'Ama' } });
        expect(first).toEqual({ success: true });

        const second = await redeemTesterPin.run({ data: { pin: 'ABCDE', name: 'Kofi' } });
        expect(second).toEqual({ success: false, reason: 'used' });
    });

    it('truncates an overlong name to 80 characters', async () => {
        await db().collection('testerPins').doc('ABCDE').set({ used: false });
        const longName = 'A'.repeat(200);

        await redeemTesterPin.run({ data: { pin: 'ABCDE', name: longName } });

        const pin = (await db().collection('testerPins').doc('ABCDE').get()).data();
        expect(pin.usedByName).toHaveLength(80);
    });
});
