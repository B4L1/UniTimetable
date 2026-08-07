import { describe, it, expect } from 'vitest';
import { TIME_SLOTS, computeSlotSpan } from '../schedule';

describe('computeSlotSpan', () => {
    it('finds the single slot a normal class falls in', () => {
        expect(computeSlotSpan('08:00', '09:50')).toEqual({ startSlot: 0, span: 1 });
        expect(computeSlotSpan('18:30', '20:20')).toEqual({ startSlot: 5, span: 1 });
    });

    it('spans multiple slots for a longer class', () => {
        // Kriptográfia és adatbiztonság e.a. in the live data spans 10:00-13:40,
        // which overlaps both the 3-4 (10:00-11:50) and 5-6 (12:30-14:20) slots.
        expect(computeSlotSpan('10:00', '13:40')).toEqual({ startSlot: 1, span: 2 });
    });

    it('returns null for a time range outside every slot', () => {
        expect(computeSlotSpan('21:00', '22:00')).toBeNull();
        expect(computeSlotSpan('06:00', '07:30')).toBeNull();
    });

    it('does not match a class that only touches a slot boundary (half-open range)', () => {
        // Ends exactly when the 3-4 slot starts — shouldn't count as overlapping it.
        expect(computeSlotSpan('08:50', '10:00')).toEqual({ startSlot: 0, span: 1 });
    });

    it('respects a custom slot list', () => {
        const customSlots = [{ label: 'A', start: '09:00', end: '10:00' }];
        expect(computeSlotSpan('08:00', '09:50', customSlots)).toEqual({ startSlot: 0, span: 1 });
        expect(computeSlotSpan('10:00', '11:00', customSlots)).toBeNull();
    });

    it('TIME_SLOTS covers the documented 6 teaching slots in order', () => {
        expect(TIME_SLOTS.map(s => s.label)).toEqual(['1-2', '3-4', '5-6', '7-8', '9-10', '11-12']);
    });
});
