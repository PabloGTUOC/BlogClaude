<template>
  <div>
    <!-- CRT power-on screen flash -->
    <div class="crt-flash"></div>

    <!-- Navigation Header -->
    <nav class="nav select-none">
      <router-link to="/" class="nav__logo hover:text-white">
        ENDERTHOUGHTS <span class="hidden sm:inline">// SYSTEM</span>
      </router-link>
      <div class="nav__tabs">
        <!-- Exact match for public home feed -->
        <router-link to="/" class="tab" :class="{ 'tab--active': $route.path === '/' }">
          [ PUBLIC ]
        </router-link>

        <template v-if="isApproved || isAdmin">
          <router-link to="/analog" class="tab" active-class="tab--active">
            [ ANALOG ]
          </router-link>
          <router-link to="/digital" class="tab" active-class="tab--active">
            [ DIGITAL ]
          </router-link>
        </template>

        <template v-if="isAdmin">
          <router-link to="/admin" class="tab" active-class="tab--active">
            [ ADMIN ]
          </router-link>
        </template>

        <!-- Authentication Badge -->
        <router-link v-if="!isAuthenticated" to="/login" class="nav__auth font-label hover:text-white transition-colors duration-150">
          [ AUTHENTICATE ]
        </router-link>
        <span v-else class="nav__auth font-label text-fog select-none flex items-center gap-2">
          <span>{{ userProfileName }} ●</span>
          <button class="text-xs text-neon-red hover:underline focus:outline-none" @click="handleLogout">
            [ OUT ]
          </button>
        </span>
      </div>
    </nav>

    <!-- Main Content scrolls between Top Nav and Bottom Status Bar -->
    <main class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))]">
      <router-view v-slot="{ Component }">
        <transition name="wipe" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>

    <!-- Global bottom status bar -->
    <StatusBar />

    <!-- Global toasts + confirm dialog (replaces native alert/confirm) -->
    <GlobalNotifications />
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import StatusBar from '@/components/StatusBar.vue';
import GlobalNotifications from '@/components/GlobalNotifications.vue';

export default {
  name: 'App',
  components: {
    StatusBar,
    GlobalNotifications
  },
  setup() {
    const authStore = useAuthStore();
    const router = useRouter();

    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const userProfileName = computed(() => authStore.user?.name || 'USER');
    const isApproved = computed(() => authStore.isApproved);
    const isAdmin = computed(() => authStore.isAdmin);

    const handleLogout = () => {
      authStore.logout();
      router.push('/');
    };

    onMounted(() => {
      // Run JWT validations check on startup
      authStore.checkTokenValidity();
    });

    return {
      isAuthenticated,
      userProfileName,
      isApproved,
      isAdmin,
      handleLogout
    };
  }
};
</script>

<style>
/* Horizontal terminal screen wipe transitions */
.wipe-enter-active, .wipe-leave-active {
  transition: opacity var(--dur) var(--ease), transform var(--dur) var(--ease);
}
.wipe-enter-from {
  opacity: 0;
  transform: translateX(12px);
}
.wipe-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}
</style>
