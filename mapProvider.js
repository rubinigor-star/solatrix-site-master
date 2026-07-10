export function createMockMapProvider() {
  return {
    name: 'mock-map',
    async searchAddress(address) {
      return { address, center: { lat: 32.794, lng: 34.989 }, zoom: 19 };
    },
    getInitialSurfaces() {
      return [];
    },
    createSurface(index = 0) {
      const presets = [
        { points: '17,58 77,42 86,78 24,88', area: 74, orientation: 'South', factor: 1 },
        { points: '14,18 48,10 52,36 16,46', area: 36, orientation: 'East', factor: 0.88 },
        { points: '58,14 86,18 80,38 56,34', area: 22, orientation: 'West', factor: 0.82 }
      ];
      return { id: index + 1, name: `Surface ${index + 1}`, ...presets[index % presets.length] };
    }
  };
}

export function createRealMapProviderPlaceholder() {
  return {
    name: 'real-map-placeholder',
    async searchAddress() {
      throw new Error('Real map provider is not connected yet.');
    },
    getInitialSurfaces() {
      return [];
    },
    createSurface() {
      throw new Error('Use real polygon editor output.');
    }
  };
}
