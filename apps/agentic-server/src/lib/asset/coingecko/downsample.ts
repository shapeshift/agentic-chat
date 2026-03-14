export function downsample(points: [number, number][], dataPoints: number): [number, number][] {
  if (points.length === 0) return []
  if (dataPoints >= points.length) return points

  if (dataPoints === 1) return [points[points.length - 1]!]

  const result: [number, number][] = []
  for (let i = 0; i < dataPoints; i++) {
    const index = Math.round((i * (points.length - 1)) / (dataPoints - 1))
    result.push(points[index]!)
  }
  return result
}
