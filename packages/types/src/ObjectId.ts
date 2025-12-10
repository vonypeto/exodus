import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export function ObjectId(uid: string, random: string): mongoose.Types.ObjectId {
  const combinedString = `${uid}${random}`;
  const hash = crypto.createHash('sha256').update(combinedString).digest('hex');
  return new mongoose.Types.ObjectId(hash.substring(0, 24));
}
