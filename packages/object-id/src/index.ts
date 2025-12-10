import bs58 from 'bs58';
import { randomBytes } from 'crypto';

export class ObjectId {
  private _buffer: Buffer;

  constructor(value?: Buffer) {
    if (value) {
      this._buffer = value;
      return;
    }

    // 16 bytes (128 bits)
    this._buffer = Buffer.alloc(16);

    // ---- 6 bytes timestamp (48-bit ms) ----
    const now = BigInt(Date.now());

    this._buffer[0] = Number((now >> 40n) & 0xffn);
    this._buffer[1] = Number((now >> 32n) & 0xffn);
    this._buffer[2] = Number((now >> 24n) & 0xffn);
    this._buffer[3] = Number((now >> 16n) & 0xffn);
    this._buffer[4] = Number((now >> 8n) & 0xffn);
    this._buffer[5] = Number(now & 0xffn);

    // ---- 10 random bytes ----
    const rand = randomBytes(10);
    this._buffer.set(rand, 6);
  }

  public get buffer() {
    return this._buffer;
  }

  public equals(other: ObjectId) {
    return this._buffer.equals(other._buffer);
  }

  public compare(other: ObjectId) {
    return this._buffer.compare(other._buffer);
  }

  public static from(value: string | Buffer | ObjectId) {
    if (value instanceof Buffer) return new ObjectId(value);
    return new ObjectId(Buffer.from(bs58.decode(value as string)));
  }

  public static generate() {
    return new ObjectId();
  }

  public toString(encoding: 'bs58' | 'hex' | 'base64' = 'bs58') {
    if (encoding === 'bs58') return bs58.encode(this._buffer);
    return this._buffer.toString(encoding);
  }
}
