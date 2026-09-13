const path = require('path');

const APP_DIR = path.resolve(__dirname);

module.exports = {
  apps: [
    {
      name: 'cra-api',
      script: path.join(APP_DIR, 'packages/api/dist/index.js'),
      cwd: APP_DIR,
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
      },
      error_file: path.join(APP_DIR, 'logs/api-error.log'),
      out_file: path.join(APP_DIR, 'logs/api-out.log'),
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 3000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      autorestart: true,
    },
  ],
};
