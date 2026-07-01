<template>
  <div class="wrap py-10">

    <!-- Header -->
    <header class="flex items-start justify-between border-b border-gridColor pb-6 mb-8 gap-4">
      <div>
        <h2 class="font-display text-3xl md:text-4xl text-white uppercase tracking-wide">
          ANALOG ARCHIVE
        </h2>
        <p class="text-xs font-body text-fog mt-1 select-none">
          {{ galleries.length }} ROLL{{ galleries.length !== 1 ? 'S' : '' }} IN ARCHIVE
        </p>
      </div>
      <router-link
        v-if="isAdmin"
        to="/admin/analog"
        class="btn btn--ghost btn--sm text-xs select-none flex-shrink-0 self-start"
      >
        [ MANAGE ROLLS ]
      </router-link>
    </header>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      READING ARCHIVE INDEXES<span class="cursor">...</span>
    </div>

    <!-- Empty -->
    <div v-else-if="galleries.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor/60 text-center select-none">
      // NO ANALOG ROLLS ARCHIVED YET //
    </div>

    <!-- Roll cards grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      <router-link
        v-for="g in galleries"
        :key="g.id"
        :to="`/analog/${g.id}`"
        class="group block border border-gridColor bg-surface hover:border-phosphor/40 transition-colors duration-200"
      >
        <!-- Cover image area -->
        <div class="aspect-[4/3] overflow-hidden bg-panel relative">
          <img
            v-if="coverUrl(g)"
            :src="coverUrl(g)"
            class="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            :alt="g.title"
            loading="lazy"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <span class="font-display text-7xl text-dust/20 select-none">
              {{ String(g.id).padStart(3, '0') }}
            </span>
          </div>

          <!-- Frame count -->
          <div class="absolute bottom-0 right-0 bg-void/80 font-label text-[11px] text-dust px-2 py-1 select-none">
            {{ g.photo_count }} FRAMES
          </div>

          <!-- Phosphor top accent on hover -->
          <div class="absolute top-0 left-0 right-0 h-[2px] bg-phosphor opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
        </div>

        <!-- Roll metadata -->
        <div class="p-4 space-y-2 border-t border-gridColor">
          <div class="flex items-baseline gap-2">
            <span class="font-label text-xs text-dust/50 select-none flex-shrink-0">
              #{{ String(g.id).padStart(3, '0') }}
            </span>
            <h3 class="font-display text-xl text-white uppercase tracking-wide leading-none group-hover:text-phosphor transition-colors duration-150 truncate">
              {{ g.title }}
            </h3>
          </div>
          <GalleryMeta
            :camera="g.camera"
            :film-stock="g.film_stock"
            :month="g.month"
            :year="g.year"
            :tags="parseTags(g.tags)"
          />
        </div>
      </router-link>
    </div>

  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useAnalogStore } from '@/stores/analog';
import { useAuthStore } from '@/stores/auth';
import GalleryMeta from '@/components/GalleryMeta.vue';

export default {
  name: 'AnalogGalleryList',
  components: {
    GalleryMeta
  },
  setup() {
    const analogStore = useAnalogStore();
    const authStore = useAuthStore();

    const galleries = computed(() => analogStore.galleries);
    const loading = computed(() => analogStore.loading);
    const isAdmin = computed(() => authStore.isAdmin);

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const coverUrl = (g) => {
      if (!g.cover_thumbnail) return null;
      if (g.cover_thumbnail.startsWith('http')) return g.cover_thumbnail;
      return `${apiBase}/uploads/${g.cover_thumbnail}`;
    };

    const parseTags = (tags) => {
      if (!tags) return [];
      if (typeof tags === 'string') {
        try { return JSON.parse(tags); } catch { return []; }
      }
      return Array.isArray(tags) ? tags : [];
    };

    onMounted(() => {
      analogStore.fetchGalleries();
    });

    return {
      galleries,
      loading,
      isAdmin,
      coverUrl,
      parseTags
    };
  }
};
</script>
