<template>
  <div class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))] flex items-center justify-center p-6 relative">
    <!-- Centered Card -->
    <div class="demo bracket max-w-[420px] w-full bg-surface border border-gridColor p-8 z-10 flex flex-col items-center">
      <span class="br-tr"></span><span class="br-bl"></span>

      <h2 class="text-white font-display text-4xl uppercase text-shadow-phosphor text-center mb-6 select-none">
        // AUTHENTICATE //
      </h2>

      <p class="text-xs font-body text-fog text-center mb-8 select-none leading-relaxed">
        ACCESS REQUIRES GOOGLE IDENTITY VERIFICATION.<br />
        NODE CONNECTIONS ARE MONITORED AND LOGGED.
      </p>

      <!-- Error indicator -->
      <div v-if="error" class="w-full text-xs font-body text-neon-red border-l-2 border-neon-red bg-void p-3 mb-6">
        ALERT: {{ error }}
      </div>

      <!-- Google OAuth Primary Button -->
      <button
        class="btn w-full text-sm"
        :disabled="loading"
        @click="handleGoogleLogin"
      >
        <span v-if="loading">AUTHENTICATING<span class="cursor">_</span></span>
        <span v-else>[ SIGN IN WITH GOOGLE ]</span>
      </button>

      <!-- Mock Developer Shortcuts -->
      <template v-if="isMockAuth">
        <div class="w-full text-center font-label text-xs text-dust mt-8 mb-2 select-none">
          // DEV BYPASS CHANNELS //
        </div>
        <div class="flex gap-2 w-full select-none">
          <button class="btn btn--ghost btn--sm flex-1 text-xs" @click="devMockLogin('mock-admin-token')">
            [ MOCK ADMIN ]
          </button>
          <button class="btn btn--ghost btn--sm flex-1 text-xs" @click="devMockLogin('family@enderthoughts.com')">
            [ MOCK USER ]
          </button>
        </div>
      </template>

      <!-- Footer Micro-text -->
      <p class="text-xs font-body text-dust text-center mt-8 select-none leading-relaxed">
        SECURE TRANSMISSION SEC-OAUTH v2 // ALL CONNECTIONS LOGGED // TERMINAL ID: 0x84ED
      </p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';
import { auth, provider, signInWithPopup, isMock } from '@/services/firebase';

export default {
  name: 'Login',
  setup() {
    const authStore = useAuthStore();
    const router = useRouter();
    const loading = ref(false);
    const error = ref(null);
    const isMockAuth = ref(isMock);

    const handleGoogleLogin = async () => {
      loading.value = true;
      error.value = null;

      try {
        if (isMock) {
          await devMockLogin('mock-admin-token');
          return;
        }

        const result = await signInWithPopup(auth, provider);
        const firebaseToken = await result.user.getIdToken();
        const user = await authStore.loginWithFirebaseToken(firebaseToken);
        redirectUser(user);
      } catch (err) {
        console.error('Google Sign-in failed:', err);
        error.value = err.response?.data?.error || err.message || 'OAuth failure';
      } finally {
        loading.value = false;
      }
    };

    const devMockLogin = async (mockToken) => {
      loading.value = true;
      error.value = null;
      try {
        const user = await authStore.loginWithFirebaseToken(mockToken);
        redirectUser(user);
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    };

    const redirectUser = (user) => {
      if (user.status === 'pending') {
        router.push('/waiting');
      } else if (user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/analog');
      }
    };

    return {
      loading,
      error,
      isMockAuth,
      handleGoogleLogin,
      devMockLogin
    };
  }
};
</script>
