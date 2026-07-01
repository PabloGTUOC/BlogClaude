<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="modal-backdrop"
      @click.self="close"
    >
      <div
        ref="dialogEl"
        class="demo bracket modal-panel"
        :style="{ maxWidth }"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        tabindex="-1"
        @keydown.esc.prevent="close"
        @keydown.tab="trapTab"
      >
        <span class="br-tr"></span><span class="br-bl"></span>

        <h3 :id="titleId" class="modal__title text-shadow-phosphor">
          <slot name="title">{{ title }}</slot>
        </h3>

        <slot />
      </div>
    </div>
  </Teleport>
</template>

<script>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue';

let uid = 0;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default {
  name: 'TerminalModal',
  props: {
    modelValue: { type: Boolean, default: false },
    title: { type: String, default: '' },
    maxWidth: { type: String, default: '500px' }
  },
  emits: ['update:modelValue', 'close'],
  setup(props, { emit }) {
    const dialogEl = ref(null);
    const titleId = `terminal-modal-${++uid}`;
    let lastFocused = null;

    const close = () => {
      emit('update:modelValue', false);
      emit('close');
    };

    const focusables = () => {
      if (!dialogEl.value) return [];
      return Array.from(dialogEl.value.querySelectorAll(FOCUSABLE))
        .filter((el) => el.offsetParent !== null);
    };

    // Keep Tab focus inside the dialog while it is open.
    const trapTab = (e) => {
      const els = focusables();
      if (els.length === 0) {
        e.preventDefault();
        dialogEl.value?.focus();
        return;
      }
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement;
      const inside = dialogEl.value?.contains(active);
      if (e.shiftKey) {
        if (active === first || !inside) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !inside) {
        e.preventDefault();
        first.focus();
      }
    };

    watch(
      () => props.modelValue,
      async (open) => {
        if (open) {
          lastFocused = document.activeElement;
          document.body.style.overflow = 'hidden';
          await nextTick();
          (focusables()[0] || dialogEl.value)?.focus();
        } else {
          document.body.style.overflow = '';
          if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
          }
          lastFocused = null;
        }
      }
    );

    onBeforeUnmount(() => {
      document.body.style.overflow = '';
    });

    return { dialogEl, titleId, close, trapTab };
  }
};
</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal);
  background: rgba(10, 10, 15, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
}

.modal-panel {
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  background: var(--surface);
  border: 1px solid var(--grid);
  padding: var(--space-6);
}

.modal__title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  line-height: 1.1;
  text-transform: uppercase;
  color: var(--white);
  margin-bottom: var(--space-5);
}
</style>
