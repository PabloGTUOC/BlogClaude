<template>
  <div class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))] flex flex-col md:flex-row relative">
    <!-- Admin Sidebar Nav -->
    <aside class="w-full md:w-[240px] bg-surface border-b md:border-b-0 md:border-r border-gridColor select-none flex-shrink-0">
      <div class="p-4 md:p-6 border-b border-gridColor">
        <div class="kicker text-[10px] mb-1">// SECURITY CONTROL //</div>
        <h3 class="text-white font-ui text-sm font-bold tracking-wide uppercase">ADMIN TERMINAL</h3>
      </div>
      
      <div class="flex md:flex-col p-2 md:p-0 gap-1 md:gap-0 overflow-x-auto md:overflow-x-visible">
        <router-link 
          to="/admin/feed" 
          class="flex-shrink-0 md:flex-shrink-1 px-4 py-3 font-label text-xs uppercase flex items-center justify-between border-l-2 border-transparent text-dust hover:text-chrome"
          active-class="border-phosphor bg-panel text-white text-shadow-phosphor"
        >
          <span>Feed Manager</span>
        </router-link>

        <router-link 
          to="/admin/analog" 
          class="flex-shrink-0 md:flex-shrink-1 px-4 py-3 font-label text-xs uppercase flex items-center justify-between border-l-2 border-transparent text-dust hover:text-chrome"
          active-class="border-phosphor bg-panel text-white text-shadow-phosphor"
        >
          <span>Analog Galleries</span>
        </router-link>

        <router-link 
          to="/admin/digital" 
          class="flex-shrink-0 md:flex-shrink-1 px-4 py-3 font-label text-xs uppercase flex items-center justify-between border-l-2 border-transparent text-dust hover:text-chrome"
          active-class="border-phosphor bg-panel text-white text-shadow-phosphor"
        >
          <span>Digital Timeline</span>
        </router-link>

        <router-link 
          to="/admin/tags" 
          class="flex-shrink-0 md:flex-shrink-1 px-4 py-3 font-label text-xs uppercase flex items-center justify-between border-l-2 border-transparent text-dust hover:text-chrome"
          active-class="border-phosphor bg-panel text-white text-shadow-phosphor"
        >
          <span>Tag Taxonomy</span>
        </router-link>

        <router-link 
          to="/admin/users" 
          class="flex-shrink-0 md:flex-shrink-1 px-4 py-3 font-label text-xs uppercase flex items-center justify-between border-l-2 border-transparent text-dust hover:text-chrome"
          active-class="border-phosphor bg-panel text-white text-shadow-phosphor"
        >
          <span>User Approvals</span>
          <span v-if="pendingCount > 0" class="ml-2 bg-neon-red text-void font-ui font-bold text-[10px] px-1.5 py-0.5 rounded-sm animate-pulse">
            {{ pendingCount }}
          </span>
        </router-link>
      </div>
    </aside>

    <!-- Admin Sub-view Area -->
    <section class="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
      <router-view />
    </section>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';

export default {
  name: 'AdminLayout',
  setup() {
    const adminStore = useAdminStore();
    const pendingCount = computed(() => adminStore.pendingCount);

    onMounted(() => {
      // Load pending users count to populate navigation badge
      adminStore.fetchUsers('pending');
    });

    return {
      pendingCount
    };
  }
};
</script>
