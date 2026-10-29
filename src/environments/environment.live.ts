/**
 * Used by `npm run start:live` (ng serve --configuration live): the app on your PC, talking to the
 * API on the real server.
 *
 * Put the address of your server here. The server must allow the page's origin in
 * CORS_ALLOWED_ORIGINS in its .env (http://localhost:4200 for ng serve).
 */
export const environment = {
  production: false,
  appName: 'Face Attendance',
  apiBaseUrl: 'http://162.4.73.10/api/v1',
};
