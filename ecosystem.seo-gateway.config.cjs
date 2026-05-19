module.exports = {
  apps: [
    {
      name: "madkontrollen-seo-gateway",
      script: "server/seo-gateway.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        NODE_ENV: "production",
        PORT: "3100",
        GOOGLE_APPLICATION_CREDENTIALS: "/absolute/path/serviceAccountKey.json",
        SEO_GATEWAY_CACHE_TTL_SECONDS: "300",
        SEO_ALLOWED_ROOT_DOMAIN: "madkontrollen.dk",
        SEO_GATEWAY_INTERNAL_TOKEN: "change-me"
      }
    }
  ]
};
