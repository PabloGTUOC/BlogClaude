<template>
  <div>
    <!-- TOAST STACK -->
    <div class="toasts" role="status" aria-live="polite">
      <transition-group name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          :class="['toast', `toast--${t.tone}`]"
          @click="dismissToast(t.id)"
        >
          <span class="toast__glyph" aria-hidden="true">{{ glyph(t.tone) }}</span>
          <span class="toast__msg">{{ t.message }}</span>
          <button
            v-if="t.action"
            class="toast__act"
            @click.stop="runAction(t)"
          >[ {{ t.action.label }} ]</button>
          <button class="toast__close" aria-label="Dismiss" @click.stop="dismissToast(t.id)">[ x ]</button>
        </div>
      </transition-group>
    </div>

    <!-- CONFIRM DIALOG -->
    <transition name="conf-fade">
      <div
        v-if="confirmState.active"
        class="conf-overlay"
        @click.self="cancel"
      >
        <div
          ref="dialogEl"
          class="conf demo bracket"
          :class="{ 'conf--danger': confirmState.tone === 'danger' }"
          role="alertdialog"
          aria-modal="true"
          tabindex="-1"
          :aria-label="confirmState.title"
        >
          <span class="br-tr"></span><span class="br-bl"></span>

          <h3 class="conf__title">// {{ confirmState.title }}<span class="cursor">_</span></h3>
          <p class="conf__msg">{{ confirmState.message }}</p>

          <div class="conf__actions">
            <button class="btn btn--ghost btn--sm" @click="cancel">[ {{ confirmState.cancelLabel }} ]</button>
            <button
              class="btn btn--sm"
              :class="{ 'btn--danger': confirmState.tone === 'danger' }"
              @click="accept"
            >
              [ {{ confirmState.confirmLabel }} ]
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useUiStore } from '@/stores/ui';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default {
  name: 'GlobalNotifications',
  setup() {
    const ui = useUiStore();
    const { toasts, confirmState } = storeToRefs(ui);
    const dialogEl = ref(null);
    let lastFocused = null;

    const glyph = (tone) => ({ success: '✓', error: '!', info: '›' }[tone] || '›');

    const accept = () => ui.resolveConfirm(true);
    const cancel = () => ui.resolveConfirm(false);
    const dismissToast = (id) => ui.dismissToast(id);
    const runAction = (t) => {
      const handler = t.action && t.action.handler;
      ui.dismissToast(t.id);
      if (handler) handler();
    };

    const focusables = () => {
      if (!dialogEl.value) return [];
      return Array.from(dialogEl.value.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
    };

    const onKeydown = (e) => {
      if (!confirmState.value.active) return;
      if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      else if (e.key === 'Enter') { e.preventDefault(); accept(); }
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog.
        const els = focusables();
        if (els.length === 0) { e.preventDefault(); dialogEl.value?.focus(); return; }
        const first = els[0];
        const last = els[els.length - 1];
        const active = document.activeElement;
        const inside = dialogEl.value?.contains(active);
        if (e.shiftKey) {
          if (active === first || !inside) { e.preventDefault(); last.focus(); }
        } else if (active === last || !inside) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    // On open: remember the trigger, focus the confirm button (default action).
    // On close: restore focus to whatever opened the dialog.
    watch(() => confirmState.value.active, async (active) => {
      if (active) {
        lastFocused = document.activeElement;
        await nextTick();
        const els = focusables();
        (els[els.length - 1] || dialogEl.value)?.focus();
      } else if (lastFocused && typeof lastFocused.focus === 'function') {
        lastFocused.focus();
        lastFocused = null;
      }
    });

    onMounted(() => window.addEventListener('keydown', onKeydown));
    onUnmounted(() => window.removeEventListener('keydown', onKeydown));

    return { toasts, confirmState, dialogEl, glyph, accept, cancel, dismissToast, runAction };
  }
};
</script>

<style scoped>
/* ---------- toasts ---------- */
.toasts {
  position: fixed;
  right: var(--space-4);
  bottom: calc(var(--status-h) + var(--space-4));
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  max-width: min(380px, calc(100vw - var(--space-4) * 2));
  pointer-events: none;
}

.toast {
  pointer-events: auto;
  cursor: pointer;
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--grid);
  border-left-width: 1px;
  font-family: var(--font-body);
  font-size: 12px;
  line-height: 1.4;
  color: var(--chrome);
  box-shadow: 0 0 0 1px var(--void), 0 6px 20px rgba(0, 0, 0, 0.5);
}

.toast--success { border-color: var(--phosphor); box-shadow: var(--glow-phosphor), 0 6px 20px rgba(0,0,0,0.5); }
.toast--error   { border-color: var(--neon-red); box-shadow: var(--glow-red), 0 6px 20px rgba(0,0,0,0.5); }
.toast--info    { border-color: var(--dust); }

.toast__glyph {
  font-family: var(--font-label);
  font-weight: 700;
  line-height: 1.4;
  flex-shrink: 0;
}
.toast--success .toast__glyph { color: var(--phosphor); }
.toast--error .toast__glyph   { color: var(--neon-red); }
.toast--info .toast__glyph    { color: var(--fog); }

.toast__msg { flex: 1; min-width: 0; word-break: break-word; }

.toast__act {
  flex-shrink: 0;
  font-family: var(--font-label);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--phosphor);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: text-shadow var(--dur-fast) var(--ease);
}
.toast__act:hover { text-shadow: var(--glow-phosphor); }

.toast__close {
  flex-shrink: 0;
  font-family: var(--font-label);
  font-size: 10px;
  color: var(--dust);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color var(--dur-fast) var(--ease);
}
.toast__close:hover { color: var(--chrome); }

/* toast motion: slide in from the right */
.toast-enter-active, .toast-leave-active { transition: transform var(--dur) var(--ease), opacity var(--dur) var(--ease); }
.toast-enter-from { transform: translateX(16px); opacity: 0; }
.toast-leave-to { transform: translateX(16px); opacity: 0; }
.toast-leave-active { position: absolute; }

/* ---------- confirm dialog ---------- */
.conf-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-confirm);
  background: rgba(10, 10, 15, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-5);
}

.conf {
  width: 100%;
  max-width: 440px;
  background: var(--surface);
  border: 1px solid var(--grid);
  padding: var(--space-6);
}
.conf--danger { border-color: rgba(255, 45, 85, 0.5); }

.conf__title {
  font-family: var(--font-display);
  font-size: 28px;
  line-height: 1;
  text-transform: uppercase;
  color: var(--white);
  text-shadow: var(--glow-phosphor);
  margin-bottom: var(--space-4);
}
.conf--danger .conf__title { color: var(--neon-red); text-shadow: var(--glow-red); }

.conf__msg {
  font-family: var(--font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--chrome);
  margin-bottom: var(--space-6);
}

.conf__actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
}

.conf-fade-enter-active, .conf-fade-leave-active { transition: opacity var(--dur) var(--ease); }
.conf-fade-enter-from, .conf-fade-leave-to { opacity: 0; }

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .toast-enter-active, .toast-leave-active,
  .conf-fade-enter-active, .conf-fade-leave-active { transition: opacity var(--dur-fast) var(--ease); }
  .toast-enter-from, .toast-leave-to { transform: none; }
}
</style>
