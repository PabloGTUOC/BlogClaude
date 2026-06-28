<template>
  <div class="border border-gridColor bg-surface/50">
    <!-- Main row -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
      <div class="flex items-center gap-3">
        <img :src="avatarUrl" class="w-10 h-10 border border-gridColor object-cover" alt="Profile" />
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-white font-medium text-sm font-label">{{ user.name }}</span>
            <span :class="['rbadge', roleBadgeClass]">{{ user.role }}</span>
            <span v-if="user.group" class="rbadge rbadge--viewer">{{ user.group }}</span>
          </div>
          <div class="text-xs font-body text-fog">{{ user.email }}</div>
          <div class="text-[10px] font-body text-dust">REGISTERED: {{ formattedDate }}</div>
        </div>
      </div>

      <div class="flex items-center gap-2 self-end sm:self-auto select-none">
        <button
          v-if="user.status === 'approved'"
          class="btn btn--ghost btn--sm text-[10px]"
          @click="showRoleEditor = !showRoleEditor"
        >
          [ {{ showRoleEditor ? 'CLOSE' : 'SET ROLE' }} ]
        </button>

        <template v-if="user.status === 'pending'">
          <button class="btn btn--sm" @click="$emit('approve', user.id)">[ APPROVE ]</button>
          <button class="btn btn--danger btn--sm" @click="$emit('revoke', user.id)">[ REVOKE ]</button>
        </template>
        <template v-else-if="user.status === 'approved'">
          <button class="btn btn--danger btn--sm" @click="$emit('revoke', user.id)">[ REVOKE ]</button>
        </template>
        <template v-else-if="user.status === 'revoked'">
          <button class="btn btn--sm" @click="$emit('restore', user.id)">[ RESTORE ]</button>
        </template>
      </div>
    </div>

    <!-- Inline role editor (approved users only) -->
    <div v-if="showRoleEditor" class="px-4 pb-4 pt-3 border-t border-gridColor/40 flex flex-wrap gap-3 items-end">
      <div class="flex flex-col gap-1">
        <label class="text-[10px] font-label text-dust uppercase">Role</label>
        <select v-model="editRole" class="tinput w-32">
          <option value="family">family</option>
          <option value="friend">friend</option>
          <option value="user">user</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div v-if="editRole === 'friend'" class="flex flex-col gap-1">
        <label class="text-[10px] font-label text-dust uppercase">Group (= gallery tag)</label>
        <select v-model="editGroup" class="tinput w-36">
          <option value="">— no group (sees nothing) —</option>
          <option v-for="t in tags" :key="t.id" :value="t.name">{{ t.name }}</option>
        </select>
      </div>
      <button class="btn btn--sm text-xs" :disabled="saving" @click="saveRole">
        {{ saving ? '[ SAVING... ]' : '[ SAVE ]' }}
      </button>
      <p v-if="saveError" class="text-xs text-neon-red font-body w-full">{{ saveError }}</p>
    </div>
  </div>
</template>

<script>
import { computed, ref, watch } from 'vue';

export default {
  name: 'UserRow',
  props: {
    user: { type: Object, required: true },
    tags: { type: Array, default: () => [] }
  },
  emits: ['approve', 'revoke', 'restore', 'role-updated'],
  setup(props, { emit }) {
    const showRoleEditor = ref(false);
    const editRole = ref(props.user.role);
    const editGroup = ref(props.user.group || '');
    const saving = ref(false);
    const saveError = ref('');

    watch(() => props.user, (u) => {
      editRole.value = u.role;
      editGroup.value = u.group || '';
    });

    const avatarUrl = computed(() =>
      props.user.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(props.user.name || 'user')}`
    );

    const roleBadgeClass = computed(() => {
      if (props.user.role === 'admin') return 'rbadge--admin';
      if (props.user.role === 'family') return 'rbadge--family';
      return 'rbadge--viewer';
    });

    const formattedDate = computed(() => {
      if (!props.user.registered_at) return 'N/A';
      const d = new Date(props.user.registered_at);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    });

    const saveRole = async () => {
      saving.value = true;
      saveError.value = '';
      try {
        emit('role-updated', {
          userId: props.user.id,
          role: editRole.value,
          group: editRole.value === 'friend' ? (editGroup.value || null) : null
        });
        showRoleEditor.value = false;
      } catch (e) {
        saveError.value = e.message;
      } finally {
        saving.value = false;
      }
    };

    return {
      showRoleEditor, editRole, editGroup, saving, saveError,
      avatarUrl, roleBadgeClass, formattedDate, saveRole
    };
  }
};
</script>
