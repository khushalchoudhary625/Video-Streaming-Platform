const cloudinary = require("cloudinary").v2;

const getCloudinaryConfig = () => {
    // Support all common environment variable naming conventions
    const cloud_name = (
        process.env.CLOUDINARY_CLOUD_NAME ||
        process.env.CLOUD_NAME ||
        ""
    ).trim();

    const api_key = (
        process.env.CLOUDINARY_API_KEY ||
        process.env.API_KEY ||
        ""
    ).trim();

    const api_secret = (
        process.env.CLOUDINARY_API_SECRET ||
        process.env.API_SECRET ||
        ""
    ).trim();

    if (cloud_name && api_key && api_secret) {
        return { cloud_name, api_key, api_secret };
    }

    // Support CLOUDINARY_URL format (cloudinary://api_key:api_secret@cloud_name)
    if (process.env.CLOUDINARY_URL) {
        try {
            const parsed = new URL(process.env.CLOUDINARY_URL);
            return {
                cloud_name: parsed.hostname,
                api_key: parsed.username,
                api_secret: parsed.password
            };
        } catch (e) {
            // ignore url parse error
        }
    }

    return null;
};

const configureCloudinary = () => {
    const config = getCloudinaryConfig();
    if (config) {
        cloudinary.config({
            cloud_name: config.cloud_name,
            api_key: config.api_key,
            api_secret: config.api_secret,
            secure: true
        });
        return true;
    }
    return false;
};

const isCloudinaryConfigured = () => {
    return configureCloudinary();
};

// Initialize configuration on startup
const isConfigured = configureCloudinary();
if (isConfigured) {
    const cfg = getCloudinaryConfig();
    console.log(`[Cloudinary] Successfully configured for cloud: ${cfg.cloud_name}`);
} else {
    console.log("[Cloudinary] No credentials detected in environment variables. Videos will be stored locally.");
}

module.exports = {
    cloudinary,
    isCloudinaryConfigured,
    getCloudinaryConfig
};
