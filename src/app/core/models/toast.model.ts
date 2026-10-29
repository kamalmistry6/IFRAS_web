export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  title: string;
  message: string;
  /** Milliseconds before it closes on its own. 0 keeps it until dismissed. */
  duration: number;
}
