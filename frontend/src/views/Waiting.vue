<template>
  <div class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))] flex items-center justify-center p-6 relative select-none">
    <div class="demo bracket max-w-[480px] w-full bg-surface border border-gridColor p-8 z-10 flex flex-col items-center">
      <span class="br-tr"></span><span class="br-bl"></span>
      
      <!-- Caution Sign -->
      <div class="text-amber text-6xl font-display mb-4">// HOLD //</div>
      
      <h2 class="text-white font-label text-base md:text-lg uppercase text-center mb-6 tracking-wider">
        TRANSMISSION ACCESS RESTRICTED
      </h2>

      <p class="font-body text-xs md:text-sm text-fog text-center leading-relaxed mb-6">
        Your account <b>({{ userEmail }})</b> has registered successfully on this node but is currently <span class="text-amber">PENDING</span> operator verification.
      </p>

      <div class="w-full bg-void border border-gridColor p-4 font-body text-xs text-dust space-y-2 mb-6">
        <div class="flex items-center justify-between">
          <span>CONNECTION STATUS:</span>
          <span class="text-amber font-bold">MUTED</span>
        </div>
        <div class="flex items-center justify-between">
          <span>APPROVAL CLEARANCE:</span>
          <span class="text-dust">LEVEL 0 (PUBLIC)</span>
        </div>
        <div class="flex items-center justify-between">
          <span>REGISTRATION ID:</span>
          <span>{{ userId || 'N/A' }}</span>
        </div>
      </div>

      <div class="flex gap-3 w-full">
        <button class="btn btn--ghost flex-1 text-xs" @click="handleLogout">
          [ DE-AUTHENTICATE ]
        </button>
        <button class="btn flex-1 text-xs" :disabled="checking" @click="checkStatus">
          <span v-if="checking">CHECKING...</span>
          <span v-else>[ FORCE RESYNC ]</span>
        </button>
      </div>

      <p class="text-[9px] font-body text-dust text-center mt-6">
        ALERT DISPATCHED TO NODE OPERATOR // NODEMAILER DAEMON ACTIVE
      </p>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useRouter } from 'vue-router';

export default {
  name: 'Waiting',
  setup() {
    const authStore = useAuthStore();
    const router = useRouter();
    const checking = ref(false);

    const userEmail = computed(() => authStore.user?.email || 'N/A');
    const userId = computed(() => authStore.user?.id || 'N/A');

    const checkStatus = async () => {
      checking.value = true;
      try {
        const isValid = await authStore.checkTokenValidity();
        if (isValid) {
          // If status updated in backend, user details in store will update
          if (authStore.isApproved || authStore.isAdmin) {
            router.push('/analog');
          }
        }
      } catch (err) {
        console.error('Check status error:', err);
      } finally {
        setTimeout(() => {
          checking.value = false;
        }, 800);
      }
    };

    const handleLogout = () => {
      authStore.logout();
      router.push('/login');
    };

    return {
      userEmail,
      userId,
      checking,
      checkStatus,
      handleLogout
    };
  }
};
</script>
