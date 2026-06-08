<template>
  <div class="space-y-8 select-text">
    <header class="border-b border-gridColor pb-6">
      <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
        DIGITAL TIMELINE MODERATION
      </h2>
      <p class="text-xs font-body text-fog mt-1">
        Overview of shared family monthly timelines and contribution counts.
      </p>
    </header>

    <!-- Digital timelines list -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      SCANNING DATABASE SEGMENTS<span class="cursor">...</span>
    </div>

    <div v-else-if="galleries.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none">
      // NO MONTHLY TIMELINE REGISTERS YET //
    </div>

    <div v-else class="overflow-x-auto border border-gridColor bg-surface">
      <table class="w-full text-left font-body text-xs border-collapse">
        <thead class="bg-panel/60 border-b border-gridColor font-label text-dust select-none text-[10px] uppercase">
          <tr>
            <th class="p-3 w-16 text-center">Cover</th>
            <th class="p-3">Monthly Timeline</th>
            <th class="p-3">Year / Month Index</th>
            <th class="p-3 w-28 text-center">Photo Count</th>
            <th class="p-3 w-28 text-center">Contributors</th>
            <th class="p-3 w-32 text-right">Moderation</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gridColor/50">
          <tr v-for="g in galleries" :key="g.id" class="hover:bg-panel/20">
            <!-- Cover thumbnail -->
            <td class="p-3 select-none">
              <img 
                v-if="g.cover_photo_url"
                :src="getThumbUrl(g.cover_photo_url)"
                class="w-10 h-10 border border-gridColor object-cover" 
                alt="cover" 
              />
              <div v-else class="w-10 h-10 border border-gridColor border-dashed bg-void flex items-center justify-center text-[8px] text-dust">
                NO COVER
              </div>
            </td>
            <!-- Title -->
            <td class="p-3">
              <router-link :to="`/digital/${g.year_month}`" class="text-white font-medium hover:text-amber uppercase">
                {{ g.display_name }}
              </router-link>
            </td>
            <!-- Year Month index -->
            <td class="p-3 font-label text-fog uppercase">
              {{ g.year_month }}
            </td>
            <!-- Photo Count -->
            <td class="p-3 text-center font-label text-chrome">
              {{ g.photo_count }}
            </td>
            <!-- Contributors count -->
            <td class="p-3 text-center font-label text-chrome">
              {{ g.contributor_count }}
            </td>
            <!-- Moderation link -->
            <td class="p-3 text-right select-none font-label">
              <router-link :to="`/digital/${g.year_month}`" class="text-amber hover:underline text-[10px]">
                [ MODERATE CONTROLS ]
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { computed, onMounted } from 'vue';
import { useDigitalStore } from '@/stores/digital';

export default {
  name: 'AdminDigitalManager',
  setup() {
    const digitalStore = useDigitalStore();
    const galleries = computed(() => digitalStore.galleries);
    const loading = computed(() => digitalStore.loading);
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    onMounted(() => {
      digitalStore.fetchGalleries();
    });

    const getThumbUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return `${apiBase}/uploads/${url}`;
    };

    return {
      galleries,
      loading,
      getThumbUrl
    };
  }
};
</script>
