// Extend app.json without duplicating the existing app configuration.
module.exports = ({ config }) => {
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (process.env.EAS_BUILD_PLATFORM === 'android' && !mapsKey) {
    throw new Error('Set GOOGLE_MAPS_API_KEY in the EAS build environment before building Android. Enable Maps SDK for Android and restrict the key to the app package and signing SHA-1.');
  }
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]] : []),
    ],
  };
};
