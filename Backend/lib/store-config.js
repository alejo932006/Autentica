const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, '..', 'store_config.json');

const DEFAULTS = {
    businessName: 'Autentika',
    historyText: 'Escribe aquí tu historia...',
    logoUrl: '/uploads/logo.jpg',
    showcaseImages: [],
    youtubeId: '',
    heroVideoUrl: '/uploads/herovideo.mp4',
    featuredVideoUrl: '/uploads/herovideo.mp4',
};

function loadStoreConfig() {
    let config = { ...DEFAULTS };
    if (!fs.existsSync(CONFIG_FILE)) return config;

    try {
        config = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    } catch {
        /* keep defaults */
    }

    return config;
}

module.exports = {
    CONFIG_FILE,
    DEFAULTS,
    loadStoreConfig,
};
