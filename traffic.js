const minutesPerDay = 1440;

export function summarizeTraffic(minutes, stationCount, selectedMinute = -1) {
  const counts = new Uint32Array(stationCount * 2);
  const start = selectedMinute === -1 ? 0 : selectedMinute - 60;
  const duration = selectedMinute === -1 ? minutesPerDay : 120;

  for (let offset = 0; offset < duration; offset++) {
    const minute = (start + offset + minutesPerDay) % minutesPerDay;
    for (const [index, count] of minutes[minute]) counts[index] += count;
  }
  return counts;
}
