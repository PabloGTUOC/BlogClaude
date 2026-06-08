<template>
  <div class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))] flex items-center justify-center p-6 relative">
    <!-- Centered Card -->
    <div class="demo bracket max-w-[420px] w-full bg-surface border border-gridColor p-8 z-10 flex flex-col items-center">
      <span class="br-tr"></span><span class="br-bl"></span>
      
      <h2 class="text-white font-display text-4xl uppercase text-shadow-phosphor text-center mb-8 select-none">
        // AUTHENTICATE //
      </h2>

      <!-- Error indicator -->
      <div v-if="error" class="w-full text-xs font-body text-neon-red border-l-2 border-neon-red bg-void p-3 mb-6">
        ALERT: {{ error }}
      </div>

      <div v-if="isMockAuth" class="w-full text-xs font-body text-amber border-l-2 border-amber bg-void p-3 mb-6 select-none">
        DEVELOPMENT MOCK MODE ACTIVE. Authenticate with direct mock keys or type an email below.
      </div>

      <!-- Credentials Form -->
      <form class="w-full space-y-4" @submit.prevent="handleEnterLogin">
        <div>
          <label class="text-[11px] font-label text-dust uppercase block mb-1 select-none">Email Address</label>
          <div class="tinput">
            <span class="tinput__prompt">&gt;</span>
            <input 
              v-model="email" 
              type="text" 
              placeholder="user@enderthoughts.sys" 
              required
              :disabled="loading"
            />
          </div>
        </div>

        <div>
          <label class="text-[11px] font-label text-dust uppercase block mb-1 select-none">Access Password</label>
          <div class="tinput">
            <span class="tinput__prompt">&gt;</span>
            <input 
              v-model="password" 
              type="password" 
              placeholder="••••••••" 
              :required="!isMockAuth"
              :disabled="loading"
            />
          </div>
        </div>

        <button 
          type="submit" 
          class="btn w-full mt-4" 
          :disabled="loading"
        >
          [ ENTER ]
        </button>
      </form>

      <!-- Divider -->
      <div class="w-full text-center font-label text-xs text-dust my-6 select-none">
        // OR //
      </div>

      <!-- Google OAuth Trigger Button -->
      <button 
        class="btn btn--ghost w-full" 
        :disabled="loading"
        @click="handleGoogleLogin"
      >
        [ GOOGLE OAUTH ]
      </button>

      <!-- Mock Developer Shortcuts -->
      <template v-if="isMockAuth">
        <div class="w-full text-center font-label text-[10px] text-dust mt-6 mb-2 select-none">
          // DEV BYPASS CHANNELS //
        </div>
        <div class="flex gap-2 w-full select-none">
          <button class="btn btn--ghost btn--sm flex-1 text-[10px]" @click="devMockLogin('mock-admin-token')">
            [ MOCK ADMIN ]
          </button>
          <button class="btn btn--ghost btn--sm flex-1 text-[10px]" @click="devMockLogin('family@enderthoughts.com')">
            [ MOCK USER ]
          </button>
        </div>
      </template>

      <!-- Footer Micro-text -->
      <p class="text-[10px] font-body text-dust text-center mt-8 select-none leading-relaxed">
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
    const email = ref('');
    const password = ref('');
    const loading = ref(false);
    const error = ref(null);
    const isMockAuth = ref(isMock);

    const handleGoogleLogin = async () => {
      loading.value = true;
      error.value = null;

      try {
        if (isMock) {
          // Dev mock bypass
          await devMockLogin('mock-admin-token');
          return;
        }

        // Standard Google Auth flow
        const result = await signInWithPopup(auth, provider);
        const firebaseToken = await result.user.getIdToken();
        
        // Swap for custom JWT
        const user = await authStore.loginWithFirebaseToken(firebaseToken);
        redirectUser(user);
      } catch (err) {
        console.error('Google Sign-in failed:', err);
        error.value = err.response?.data?.error || err.message || 'OAuth failure';
      } finally {
        loading.value = false;
      }
    };

    const handleEnterLogin = async () => {
      loading.value = true;
      error.value = null;

      try {
        if (isMock) {
          // In mock mode, treat the entered email as the token directly
          await devMockLogin(email.value || 'devuser@enderthoughts.com');
          return;
        }

        // Email/Password login is not supported by Firebase directly in this configuration
        error.value = 'Google OAuth authentication is required on this node.';
      } catch (err) {
        error.value = err.message;
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
      email,
      password,
      loading,
      error,
      isMockAuth,
      handleGoogleLogin,
      handleEnterLogin,
      devMockLogin
    };
  }
};
</script>
