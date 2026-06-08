<template>
  <footer class="statusbar">
    <div class="statusbar__zone">
      <span :class="['dot', dotClass]"></span>
      ZONE: {{ zoneName }}
    </div>
    <div class="statusbar__center">ENDERTHOUGHTS v1.0</div>
    <div class="statusbar__user">
      USER: <b>{{ userName }}</b> // <span>{{ clockTime }}</span>
    </div>
  </footer>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

export default {
  name: 'StatusBar',
  setup() {
    const route = useRoute();
    const authStore = useAuthStore();
    const clockTime = ref('00:00:00');
    let timer = null;

    const zoneName = computed(() => {
      if (route.path.startsWith('/analog')) return 'ANALOG';
      if (route.path.startsWith('/digital')) return 'DIGITAL';
      if (route.path.startsWith('/admin')) return 'ADMIN';
      return 'PUBLIC';
    });

    const dotClass = computed(() => {
      if (zoneName.value === 'ANALOG') return 'dot--analog';
      if (zoneName.value === 'DIGITAL') return 'dot--digital';
      if (zoneName.value === 'ADMIN') return 'dot--admin';
      return '';
    });

    const userName = computed(() => {
      return authStore.isAuthenticated && authStore.user ? authStore.user.name : 'PUBLIC';
    });

    const tick = () => {
      const d = new Date();
      const p = n => String(n).padStart(2, '0');
      clockTime.value = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    onMounted(() => {
      tick();
      timer = setInterval(tick, 1000);
    });

    onUnmounted(() => {
      if (timer) clearInterval(timer);
    });

    return {
      zoneName,
      dotClass,
      userName,
      clockTime
    };
  }
};
</script>
