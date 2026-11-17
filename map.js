import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { summarizeTraffic } from './traffic.js';

const slider = document.querySelector('#minute');
const timeOutput = document.querySelector('#selected-time');
const details = document.querySelector('#station-details');
const status = document.querySelector('#status');
const colors = ['var(--arrivals)', 'var(--balanced)', 'var(--departures)'];
const stationFlow = d3.scaleQuantize([0, 1], colors);
const mapboxToken = 'pk.eyJ1IjoiajFjaGFudGhhYmFuZGl0aC11Y3NkIiwiYSI6ImNtd2s3c21tNjAwaHgzNG9xNmlmeHczZm0ifQ.n3AKEiChKAFBsedeBrUr8Q';

async function initialize() {
  const library = mapboxToken
    ? await import('https://cdn.jsdelivr.net/npm/mapbox-gl@3.15.0/+esm')
    : await import('https://cdn.jsdelivr.net/npm/maplibre-gl@5.6.1/+esm');
  const renderer = library.default;
  const map = new renderer.Map({
    container: 'map',
    ...(mapboxToken ? { accessToken: mapboxToken } : {}),
    style: mapboxToken ? 'mapbox://styles/mapbox/streets-v12' : 'https://tiles.openfreemap.org/styles/positron',
    center: [-71.0915, 42.357],
    zoom: 11.8,
    pitchWithRotate: false,
    dragRotate: false,
  });
  map.addControl(new renderer.NavigationControl({ showCompass: false }));
  const mapReady = new Promise(resolve => map.once('load', resolve));
  const [traffic] = await Promise.all([d3.json('./data/traffic.json'), mapReady]);
  for (const city of ['boston', 'cambridge']) {
    map.addSource(city, { type: 'geojson', data: `./data/${city}.geojson` });
    map.addLayer({
      id: `${city}-bike-facilities`, type: 'line', source: city,
      paint: { 'line-color': '#33835b', 'line-width': 2, 'line-opacity': .7 },
    });
  }

  const { stations, minutes } = traffic;
  const totals = summarizeTraffic(minutes, stations.length);
  const maximum = d3.max(stations, (_, i) => totals[2 * i] + totals[2 * i + 1]);
  const radius = d3.scaleSqrt([0, maximum], [0, 25]);
  let activeStation;
  function showDetails(station) {
    activeStation = station;
    details.replaceChildren();
    details.hidden = !station;
    if (!station) return;
    const name = document.createElement('strong');
    name.textContent = station.name;
    details.append(name, document.createElement('br'),
      `${station.departures.toLocaleString()} departures · ${station.arrivals.toLocaleString()} arrivals`,
      document.createElement('br'), `${station.total.toLocaleString()} total`);
  }

  const circles = d3.select('#stations').selectAll('circle')
    .data(stations, station => station.short_name).join('circle')
    .on('pointerenter focus click', (_, station) => showDetails(station))
    .on('pointerleave blur', () => showDetails(null));

  function positionStations() {
    circles.each(function (station) {
      const position = map.project([station.lon, station.lat]);
      this.setAttribute('cx', position.x);
      this.setAttribute('cy', position.y);
    });
  }

  function updateTraffic() {
    const minute = Number(slider.value);
    const hour = Math.floor(minute / 60);
    const minuteText = String(minute % 60).padStart(2, '0');
    timeOutput.textContent = minute === -1 ? 'Any time' :
      `${hour % 12 || 12}:${minuteText} ${hour < 12 ? 'AM' : 'PM'}`;
    slider.setAttribute('aria-valuetext', timeOutput.textContent);
    const counts = minute === -1 ? totals : summarizeTraffic(minutes, stations.length, minute);
    radius.range(minute === -1 ? [0, 25] : [3, 50]);
    stations.forEach((station, i) => {
      station.departures = counts[2 * i];
      station.arrivals = counts[2 * i + 1];
      station.total = station.departures + station.arrivals;
    });
    circles.attr('r', station => station.total ? radius(station.total) : 0)
      .attr('tabindex', station => station.total ? 0 : -1)
      .attr('aria-label', station => `${station.name}, ${station.departures} departures, ${station.arrivals} arrivals`)
      .style('fill', station => stationFlow(station.total ? station.departures / station.total : .5));
    if (activeStation) showDetails(activeStation.total ? activeStation : null);
  }

  map.on('move', positionStations);
  map.on('resize', positionStations);
  slider.addEventListener('input', updateTraffic);
  positionStations();
  updateTraffic();
  slider.disabled = false;
  status.hidden = true;
}

initialize().catch(error => {
  console.error(error);
  status.textContent = 'The map could not load. Check your internet connection and reload.';
});
