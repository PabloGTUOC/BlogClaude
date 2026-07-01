import { defineStore } from 'pinia';

let toastSeq = 0;

// Global UI feedback: in-aesthetic toasts + a promise-based confirm dialog.
// Replaces native alert()/confirm() so feedback stays inside the CRT identity.
export const useUiStore = defineStore('ui', {
  state: () => ({
    toasts: [],
    confirmState: {
      active: false,
      title: '',
      message: '',
      confirmLabel: 'CONFIRM',
      cancelLabel: 'CANCEL',
      tone: 'default', // 'default' | 'danger'
      _resolve: null
    }
  }),
  actions: {
    // Push a transient toast. tone: 'info' | 'success' | 'error'.
    // Optional `action`: { label, handler } renders an inline button (e.g. retry).
    notify({ message, tone = 'info', timeout = 4500, action = null }) {
      const id = ++toastSeq;
      this.toasts.push({ id, message, tone, action });
      if (timeout > 0) {
        setTimeout(() => this.dismissToast(id), timeout);
      }
      return id;
    },
    success(message, opts = {}) {
      return this.notify({ message, tone: 'success', ...opts });
    },
    error(message, opts = {}) {
      // Errors linger longer, and longer still when an action is offered.
      const timeout = opts.action ? 12000 : 7000;
      return this.notify({ message, tone: 'error', timeout, ...opts });
    },
    dismissToast(id) {
      const i = this.toasts.findIndex(t => t.id === id);
      if (i !== -1) this.toasts.splice(i, 1);
    },
    // Returns a Promise<boolean> — resolves true on confirm, false on cancel/dismiss.
    confirm({ title = 'CONFIRM', message = '', confirmLabel = 'CONFIRM', cancelLabel = 'CANCEL', tone = 'default' }) {
      // If a confirm is already open, resolve it false before opening a new one.
      if (this.confirmState.active && this.confirmState._resolve) {
        this.confirmState._resolve(false);
      }
      return new Promise(resolve => {
        this.confirmState = {
          active: true,
          title,
          message,
          confirmLabel,
          cancelLabel,
          tone,
          _resolve: resolve
        };
      });
    },
    resolveConfirm(result) {
      const resolve = this.confirmState._resolve;
      this.confirmState.active = false;
      this.confirmState._resolve = null;
      if (resolve) resolve(result);
    }
  }
});
