export function fromBaseUnit(value: string, precision: number): string {
  return (BigInt(value) / BigInt(10 ** precision)).toString();
}

export function toBaseUnit(value: string, precision: number): string {
  return (BigInt(Math.floor(Number(value) * (10 ** precision)))).toString();
} 
