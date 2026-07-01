<template>
  <div class="space-y-8 select-text">
    <header class="border-b border-gridColor pb-6">
      <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
        USER MEMBERSHIP CONTROL
      </h2>
      <p class="text-xs font-body text-fog mt-1">
        Moderate registration pipelines and regulate node access permissions.
      </p>
    </header>

    <!-- Tab Selectors Bar -->
    <div class="flex border-b border-gridColor select-none font-label text-xs">
      <button 
        :class="['px-5 py-3 border-b-2 uppercase relative transition-all duration-150', 
                 activeTab === 'pending' ? 'border-phosphor text-phosphor text-shadow-phosphor bg-panel/30' : 'border-transparent text-dust hover:text-chrome']"
        @click="switchTab('pending')"
      >
        Pending Approval
        <span v-if="pendingCount > 0" class="ml-2 bg-neon-red text-void font-bold text-[11px] px-1 rounded-sm">
          {{ pendingCount }}
        </span>
      </button>

      <button 
        :class="['px-5 py-3 border-b-2 uppercase transition-all duration-150', 
                 activeTab === 'approved' ? 'border-phosphor text-phosphor text-shadow-phosphor bg-panel/30' : 'border-transparent text-dust hover:text-chrome']"
        @click="switchTab('approved')"
      >
        Approved Directory
      </button>

      <button 
        :class="['px-5 py-3 border-b-2 uppercase transition-all duration-150', 
                 activeTab === 'revoked' ? 'border-phosphor text-phosphor text-shadow-phosphor bg-panel/30' : 'border-transparent text-dust hover:text-chrome']"
        @click="switchTab('revoked')"
      >
        Revoked Blocklist
      </button>
    </div>

    <!-- Users Listings -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      QUERYING MEMBERSHIP STACKS<span class="cursor">...</span>
    </div>

    <div v-else-if="usersList.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none">
      // NO MEMBERS CONFIGURED IN THIS DIRECTORY //
    </div>

    <div v-else class="space-y-4">
      <UserRow
        v-for="u in usersList"
        :key="u.id"
        :user="u"
        :tags="tags"
        @approve="handleApprove"
        @revoke="handleRevoke"
        @restore="handleRestore"
        @role-updated="handleRoleUpdated"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';
import { useUiStore } from '@/stores/ui';
import UserRow from '@/components/UserRow.vue';

export default {
  name: 'AdminUserManager',
  components: {
    UserRow
  },
  setup() {
    const adminStore = useAdminStore();
    const ui = useUiStore();
    const activeTab = ref('pending');

    const loading = computed(() => adminStore.loading);
    const pendingCount = computed(() => adminStore.pendingCount);
    // Friend groups are driven by the existing tag taxonomy so a friend's group
    // can never drift from the gallery tag names used to grant access.
    const tags = computed(() => adminStore.tags);

    const usersList = computed(() => {
      if (activeTab.value === 'pending') return adminStore.usersPending;
      if (activeTab.value === 'approved') return adminStore.usersApproved;
      if (activeTab.value === 'revoked') return adminStore.usersRevoked;
      return [];
    });

    onMounted(() => {
      switchTab('pending');
      adminStore.fetchTags();
    });

    const switchTab = async (tab) => {
      activeTab.value = tab;
      await adminStore.fetchUsers(tab);
      // If we query another tab, always reload pending to keep badges accurate
      if (tab !== 'pending') {
        adminStore.fetchUsers('pending');
      }
    };

    const handleApprove = async (userId) => {
      try {
        await adminStore.approveUser(userId);
        ui.success('// ACCESS GRANTED //');
      } catch (err) {
        ui.error('Couldn\'t approve this user. Please try again.');
      }
    };

    const handleRevoke = async (userId) => {
      const ok = await ui.confirm({
        title: 'REVOKE ACCESS',
        message: 'Suspend this user and revoke all access? You can restore them later.',
        confirmLabel: 'REVOKE',
        cancelLabel: 'CANCEL',
        tone: 'danger'
      });
      if (!ok) return;
      try {
        await adminStore.revokeUser(userId, activeTab.value);
        ui.success('// ACCESS REVOKED //');
      } catch (err) {
        ui.error('Couldn\'t revoke access. Please try again.');
      }
    };

    const handleRestore = async (userId) => {
      try {
        await adminStore.restoreUser(userId);
        ui.success('// ACCESS RESTORED //');
      } catch (err) {
        ui.error('Couldn\'t restore this user. Please try again.');
      }
    };

    const handleRoleUpdated = async ({ userId, role, group }) => {
      try {
        await adminStore.updateUserRole(userId, role, group);
        ui.success('// ROLE UPDATED //');
      } catch (err) {
        ui.error('Couldn\'t update the role. Please try again.');
      }
    };

    return {
      activeTab,
      loading,
      pendingCount,
      tags,
      usersList,
      switchTab,
      handleApprove,
      handleRevoke,
      handleRestore,
      handleRoleUpdated
    };
  }
};
</script>
