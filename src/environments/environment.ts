/**
 * Production build. The API is expected on the same origin behind a reverse
 * proxy (NGINX), so a relative URL is used. Change it if the API lives elsewhere.
 */
export const environment = {
  production: true,
  appName: 'Face Attendance',
  apiBaseUrl: '/api/v1',
};
