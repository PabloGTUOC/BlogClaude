<template>
  <div class="pcard relative group select-none overflow-hidden border border-gridColor bg-surface cursor-pointer focus:outline-none focus:ring-1 focus:ring-phosphor" tabindex="0" @click="$emit('click')" @keydown.enter="$emit('click')">
    <!-- Format Badge (Top-Right) -->
    <span :class="['pcard__badge', photo.zone === 'digital' ? 'pcard__badge--digital' : '']">
      [{{ photo.zone === 'analog' ? '35mm' : 'DIGITAL' }}]
    </span>

    <!-- Thumbnail Image (poster frame for videos) -->
    <img class="pcard__img w-full h-full object-cover absolute inset-0" :src="thumbUrl" :alt="photo.caption || 'Photo'" loading="lazy" />

    <!-- Video play overlay -->
    <div v-if="photo.media_type === 'video'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span class="flex items-center justify-center w-12 h-12 rounded-full bg-void/70 border border-phosphor text-phosphor text-lg">▶</span>
      <span v-if="photo.duration" class="absolute bottom-2 right-2 bg-void/80 text-chrome font-label text-xs px-1.5 py-0.5">
        {{ formattedDuration }}
      </span>
    </div>

    <!-- Quick-action bar (always visible): tap the heart to like in place -->
    <div class="pcard__actions absolute bottom-2 left-2 z-10 flex items-center gap-2 bg-void/70 border border-gridColor px-2 py-1 font-label text-xs" @click.stop>
      <button
        type="button"
        class="flex items-center gap-1 transition-colors duration-150 disabled:opacity-60"
        :class="liked ? 'text-neon-red' : 'text-chrome hover:text-neon-red'"
        :disabled="!canInteract || likePending"
        :title="canInteract ? 'Like' : 'Log in to like'"
        @click.stop="onToggleLike"
      >
        <span>{{ liked ? '♥' : '♡' }}</span>
        <span>{{ likeCount }}</span>
      </button>
      <span class="text-fog">💬 {{ photo.comment_count || 0 }}</span>
    </div>

    <!-- Caption Overlay on Hover -->
    <div class="pcard__cap flex flex-col justify-end bg-void/90 border-t border-gridColor p-3 absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]">
      <div class="text-amber font-body text-xs md:text-sm">
        {{ photo.caption || '// NO CAPTION //' }}
        <span v-if="photo.uploader_name" class="text-fog mt-1 text-xs font-label block uppercase">
          ↑ BY {{ photo.uploader_name }}
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch } from 'vue';
import { useInteractionsStore } from '@/stores/interactions';
import { useAuthStore } from '@/stores/auth';

export default {
  name: 'PhotoCard',
  props: {
    photo: {
      type: Object,
      required: true
    }
  },
  emits: ['click'],
  setup(props) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
    const interactions = useInteractionsStore();
    const auth = useAuthStore();

    const liked = ref(!!props.photo.liked_by_me);
    const likeCount = ref(Number(props.photo.like_count) || 0);
    const likePending = ref(false);
    const canInteract = computed(() => auth.isApproved || auth.isAdmin);

    // Keep local state in sync if this card is reused for a different photo.
    watch(() => props.photo.id, () => {
      liked.value = !!props.photo.liked_by_me;
      likeCount.value = Number(props.photo.like_count) || 0;
    });

    const onToggleLike = async () => {
      if (!canInteract.value || likePending.value) return;
      likePending.value = true;
      try {
        const res = await interactions.toggleLike(props.photo.id);
        liked.value = res.liked;
        likeCount.value = res.like_count;
        // Persist onto the shared photo object so the lightbox and cached
        // lists reflect the change without a refetch.
        props.photo.liked_by_me = res.liked;
        props.photo.like_count = res.like_count;
      } finally {
        likePending.value = false;
      }
    };

    const thumbUrl = computed(() => {
      if (!props.photo.thumbnail) return '';
      if (props.photo.thumbnail.startsWith('http')) return props.photo.thumbnail;
      return `${apiBase}/uploads/${props.photo.thumbnail}`;
    });

    const imageUrl = computed(() => {
      if (!props.photo.filename) return '';
      if (props.photo.filename.startsWith('http')) return props.photo.filename;
      return `${apiBase}/uploads/${props.photo.filename}`;
    });

    const formattedDuration = computed(() => {
      const d = props.photo.duration;
      if (!d && d !== 0) return '';
      const m = Math.floor(d / 60);
      const s = d % 60;
      return `${m}:${String(s).padStart(2, '0')}`;
    });

    return {
      thumbUrl,
      imageUrl,
      formattedDuration,
      liked,
      likeCount,
      likePending,
      canInteract,
      onToggleLike
    };
  }
};
</script>
