/** Used by `ng serve` and `ng build --configuration development`. */
export const environment = {
  production: false,
  appName: 'Face Attendance',
  /** The Django API. CORS already allows http://localhost:4200. */
  apiBaseUrl: 'http://127.0.0.1:8000/api/v1',
};
