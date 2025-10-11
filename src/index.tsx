import { NitroModules } from 'react-native-nitro-modules';
import type { Tus } from './Tus.nitro';

const TusHybridObject =
  NitroModules.createHybridObject<Tus>('Tus');

export function multiply(a: number, b: number): number {
  return TusHybridObject.multiply(a, b);
}
