import type { StaticImageData } from 'next/image';
import modernTowerImg from '@/src/assets/images/building_modern_tower_1795286244783.jpg';
import courtyardBlockImg from '@/src/assets/images/building_courtyard_block_1795286244246.jpg';
import brickClassicImg from '@/src/assets/images/building_brick_classic_1795286244847.jpg';

const IMAGE_MAP: Record<string, StaticImageData> = {
  building_modern_tower: modernTowerImg,
  building_courtyard_block: courtyardBlockImg,
  building_brick_classic: brickClassicImg,
};

export function getBuildingImage(key?: string | null): StaticImageData {
  if (key && IMAGE_MAP[key]) {
    return IMAGE_MAP[key];
  }
  return modernTowerImg;
}
