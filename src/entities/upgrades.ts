export type UpgradeKey = 'armor' | 'firepower' | 'missiles' | 'engine';

export interface UpgradeDef {
  key: UpgradeKey;
  name: string;
  description: string;
  costs: number[];
}

export const UPGRADES: readonly UpgradeDef[] = [
  { key: 'armor', name: 'Blindaje', description: '+12% de vida y escudo por nivel', costs: [400, 900, 1600] },
  { key: 'firepower', name: 'Potencia de fuego', description: '+12% de daño por nivel', costs: [500, 1100, 1900] },
  { key: 'missiles', name: 'Bahía de misiles', description: '+3 misiles por nivel', costs: [300, 700, 1300] },
  { key: 'engine', name: 'Motor', description: '+6% de velocidad y turbo más eficiente', costs: [350, 800, 1400] },
];

export type UpgradeLevels = Record<UpgradeKey, number>;
export const emptyUpgrades = (): UpgradeLevels => ({ armor: 0, firepower: 0, missiles: 0, engine: 0 });
