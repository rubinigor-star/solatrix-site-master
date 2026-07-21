import baseConfig from './vite.config.js';

const existingInput = baseConfig?.build?.rollupOptions?.input || {};

export default {
  ...baseConfig,
  build: {
    ...(baseConfig.build || {}),
    rollupOptions: {
      ...(baseConfig.build?.rollupOptions || {}),
      input: {
        ...existingInput,
        pdfPreview: 'pdf-preview.html'
      }
    }
  }
};
