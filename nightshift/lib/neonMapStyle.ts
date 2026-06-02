// Cyberpunk / neon dark map style for Google Maps
const NEON_MAP_STYLE = [
  { elementType: 'geometry',        stylers: [{ color: '#08080F' }] },
  { elementType: 'labels.text.fill',stylers: [{ color: '#6B6B9A' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#08080F' }] },
  { featureType: 'administrative',    elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#9090CC' }] },
  { featureType: 'poi',               stylers: [{ visibility: 'off' }] },
  { featureType: 'road',              elementType: 'geometry.fill',   stylers: [{ color: '#1A0A2E' }] },
  { featureType: 'road',              elementType: 'labels.icon',     stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial',     elementType: 'geometry',        stylers: [{ color: '#1E0A3C' }] },
  { featureType: 'road.arterial',     elementType: 'labels.text.fill',stylers: [{ color: '#7C3AED' }] },
  { featureType: 'road.highway',      elementType: 'geometry',        stylers: [{ color: '#3B0764' }] },
  { featureType: 'road.highway',      elementType: 'geometry.stroke', stylers: [{ color: '#8B5CF6' }] },
  { featureType: 'road.highway',      elementType: 'labels.text.fill',stylers: [{ color: '#C084FC' }] },
  { featureType: 'road.local',        elementType: 'labels.text.fill',stylers: [{ color: '#4B3F72' }] },
  { featureType: 'transit',           stylers: [{ visibility: 'off' }] },
  { featureType: 'water',             elementType: 'geometry',        stylers: [{ color: '#03040E' }] },
  { featureType: 'water',             elementType: 'labels.text.fill',stylers: [{ color: '#17153A' }] },
  { featureType: 'landscape',         elementType: 'geometry',        stylers: [{ color: '#0C0C18' }] },
  { featureType: 'landscape.natural', elementType: 'geometry',        stylers: [{ color: '#0A0A14' }] },
]

export default NEON_MAP_STYLE
