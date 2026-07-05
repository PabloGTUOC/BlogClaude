<template>
  <div>
    <!-- CRT power-on screen flash -->
    <div class="crt-flash"></div>

    <!-- Navigation Header -->
    <nav class="nav select-none">
      <router-link to="/" class="nav__logo hover:text-white">
        ENDERTHOUGHTS <span class="hidden sm:inline">// SYSTEM</span>
      </router-link>
      <!-- Mobile: the current section is a drop-down trigger listing every
           destination. Desktop: inline tab strip. CSS decides which shows. -->
      <div class="nav__menu">
        <button class="nav__menu-btn" aria-haspopup="menu" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
          [ {{ currentSection }} ▾ ]
        </button>
        <div v-if="menuOpen" class="nav__menu-backdrop" @click="menuOpen = false"></div>
        <div v-if="menuOpen" class="nav__menu-panel" role="menu">
          <router-link
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="nav__menu-item"
            :class="{ 'nav__menu-item--active': item.label === currentSection }"
            role="menuitem"
            @click="menuOpen = false"
          >
            [ {{ item.label }} ]
          </router-link>
        </div>
      </div>

      <div class="nav__tabs">
        <router-link
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="tab"
          :class="{ 'tab--active': item.label === currentSection }"
        >
          [ {{ item.label }} ]
        </router-link>
      </div>

      <!-- Authentication Badge: outside the scrollable tab strip so it never
           scrolls off-screen on mobile -->
      <router-link v-if="!isAuthenticated" to="/login" class="nav__auth font-label hover:text-white transition-colors duration-150">
        [ AUTHENTICATE ]
      </router-link>
      <span v-else class="nav__auth font-label text-fog select-none flex items-center gap-2">
        <span class="nav__auth-name">{{ userProfileName }}</span>
        <span aria-hidden="true">●</span>
        <button class="text-xs text-neon-red hover:underline focus:outline-none" @click="handleLogout">
          [ OUT ]
        </button>
      </span>
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
import { computed, onMounted, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter, useRoute } from 'vue-router';
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
    const route = useRoute();

    const isAuthenticated = computed(() => authStore.isAuthenticated);
    const userProfileName = computed(() => authStore.user?.name || 'USER');
    const isApproved = computed(() => authStore.isApproved);
    const isAdmin = computed(() => authStore.isAdmin);

    const handleLogout = () => {
      authStore.logout();
      router.push('/');
    };

    // One nav model for both renderings (mobile drop-down + desktop tabs).
    const navItems = computed(() => {
      const items = [{ to: '/', label: 'PUBLIC' }];
      if (isApproved.value || isAdmin.value) {
        items.push({ to: '/analog', label: 'ANALOG' }, { to: '/digital', label: 'DIGITAL' });
      }
      if (isAdmin.value) {
        items.push({ to: '/admin', label: 'ADMIN' });
      }
      return items;
    });

    const currentSection = computed(() => {
      const p = route.path;
      if (p.startsWith('/analog')) return 'ANALOG';
      if (p.startsWith('/digital')) return 'DIGITAL';
      if (p.startsWith('/admin')) return 'ADMIN';
      return 'PUBLIC';
    });

    const menuOpen = ref(false);
    // Safety net alongside the item/backdrop click handlers.
    watch(() => route.path, () => { menuOpen.value = false; });

    onMounted(() => {
      // Run JWT validations check on startup
      authStore.checkTokenValidity();
    });

    return {
      isAuthenticated,
      userProfileName,
      isApproved,
      isAdmin,
      handleLogout,
      navItems,
      currentSection,
      menuOpen
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
