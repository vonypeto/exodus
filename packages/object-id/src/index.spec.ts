import { ObjectId } from '.';
import { describe, test, expect } from '@jest/globals';

describe('ObjectId Integration Test', () => {
  test('should generate a valid Base58 ID string', () => {
    const id = ObjectId.generate();
    const str = id.toString();

    expect(typeof str).toBe('string');
    expect(str.length).toBeGreaterThanOrEqual(20);
    expect(str).toMatch(/^[A-HJ-NP-Za-km-z1-9]+$/);
  });

  test('should convert back and forth between string and buffer', () => {
    const original = ObjectId.generate();
    const str = original.toString();

    const reconstructed = ObjectId.from(str);

    expect(reconstructed.equals(original)).toBe(true);
  });

  test('should generate unique values in batch', () => {
    const count = 5000;
    const set = new Set<string>();

    for (let i = 0; i < count; i++) {
      set.add(ObjectId.generate().toString());
    }

    expect(set.size).toBe(count);
  });

  test('IDs should be lexicographically sortable by time', async () => {
    const id1 = ObjectId.generate();

    await new Promise((r) => setTimeout(r, 5));

    const id2 = ObjectId.generate();

    expect(id1.toString() < id2.toString()).toBe(true);
  });

  test('should produce IDs safe for PostgreSQL and MongoDB storage', () => {
    const id = ObjectId.generate().toString();

    expect(id.includes("'")).toBe(false);
    expect(id.includes('"')).toBe(false);

    expect(id).toMatch(/^[A-HJ-NP-Za-km-z1-9]+$/);
  });

  test('buffer should always be exactly 16 bytes', () => {
    const id = ObjectId.generate();
    expect(id.buffer.length).toBe(16);
  });
});
