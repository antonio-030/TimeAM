/**
 * PM2 Ecosystem Configuration
 * 
 * Production-Konfiguration für TimeAM Backend und Frontend
 */

module.exports = {
  apps: [
    {
      name: 'timeam-api',
      script: './apps/api/dist/index.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      node_args: '--max-old-space-size=512',
    },
    {
      name: 'timeam-web',
      script: 'npx',
      args: 'serve -s apps/web/dist -l 3001 --single',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/web-error.log',
      out_file: './logs/web-out.log',
      log_file: './logs/web-combined.log',
      time: true,
      autorestart: true,
      watch: false,
    },
  ],
};

