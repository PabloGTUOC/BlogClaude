<template>
  <div class="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-gridColor bg-surface/50 gap-4">
    <!-- User Information Profile -->
    <div class="flex items-center gap-3">
      <img :src="avatarUrl" class="w-10 h-10 border border-gridColor object-cover" alt="Profile" />
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-white font-medium text-sm font-label">{{ user.name }}</span>
          <span :class="['rbadge', roleBadgeClass]">{{ user.role }}</span>
        </div>
        <div class="text-xs font-body text-fog">{{ user.email }}</div>
        <div class="text-[10px] font-body text-dust">REGISTERED: {{ formattedDate }}</div>
      </div>
    </div>

    <!-- User Action Controls -->
    <div class="flex items-center gap-2 self-end sm:self-auto select-none">
      <template v-if="user.status === 'pending'">
        <button class="btn btn--sm" @click="$emit('approve', user.id)">
          [ APPROVE ]
        </button>
        <button class="btn btn--danger btn--sm" @click="$emit('revoke', user.id)">
          [ REVOKE ]
        </button>
      </template>

      <template v-else-if="user.status === 'approved'">
        <button class="btn btn--danger btn--sm" @click="$emit('revoke', user.id)">
          [ REVOKE ]
        </button>
      </template>

      <template v-else-if="user.status === 'revoked'">
        <button class="btn btn--sm" @click="$emit('restore', user.id)">
          [ RESTORE ]
        </button>
      </template>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'UserRow',
  props: {
    user: {
      type: Object,
      required: true
    }
  },
  emits: ['approve', 'revoke', 'restore'],
  setup(props) {
    const avatarUrl = computed(() => {
      return props.user.avatar_url || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${encodeURIComponent(props.user.name || 'user')}`;
    });

    const roleBadgeClass = computed(() => {
      if (props.user.role === 'admin') return 'rbadge--admin';
      if (props.user.role === 'user') return 'rbadge--family';
      return 'rbadge--viewer';
    });

    const formattedDate = computed(() => {
      if (!props.user.registered_at) return 'N/A';
      const d = new Date(props.user.registered_at);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
    });

    return {
      avatarUrl,
      roleBadgeClass,
      formattedDate
    };
  }
};
</script>
