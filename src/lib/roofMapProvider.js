const providers = new Map([
  ['existing-imagery', {
    id: 'existing-imagery',
    label: 'Existing aerial imagery',
    tileUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery © Esri',
    maxZoom: 21
  }]
]);

export function getRoofMapProvider(id = 'existing-imagery') {
  return providers.get(id) || providers.get('existing-imagery');
}

export function registerRoofMapProvider(provider) {
  if (!provider?.id || !provider?.tileUrl) throw new Error('A roof map provider requires id and tileUrl.');
  providers.set(provider.id, { maxZoom: 21, attribution: '', ...provider });
}
