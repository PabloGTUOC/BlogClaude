<template>
  <div class="wrap py-12">
    <!-- Header with Dynamic Creation Action Trigger -->
    <header class="flex flex-col md:flex-row md:items-center justify-between border-b border-gridColor pb-6 mb-8 gap-4">
      <div>
        <div class="kicker mb-2">// DIGITAL ZONE // TIMELINE</div>
        <h2 class="text-white font-display text-4xl uppercase tracking-wide">
          MONTHLY TIMELINES
        </h2>
        <p class="text-xs font-body text-fog mt-1">
          Shared digital archives aggregated chronologically by calendar month.
        </p>
      </div>

      <!-- Action Button for current month -->
      <div class="select-none self-end md:self-auto">
        <router-link 
          v-if="currentMonthExists" 
          :to="`/digital/${currentMonthStr}`"
          class="btn text-xs"
        >
          [ ADD YOUR PHOTOS ]
        </router-link>
        <button 
          v-else 
          class="btn text-xs"
          :disabled="creating"
          @click="startCurrentMonthGallery"
        >
          [ START {{ currentMonthName.toUpperCase() }} GALLERY ]
        </button>
      </div>
    </header>

    <!-- Timeline List -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      LOADING DIGITAL INDEXES<span class="cursor">...</span>
    </div>

    <div v-else-if="galleries.length === 0" class="flex flex-col items-center justify-center py-20 font-label text-fog select-none">
      <div>// NO MONTHLY GALLERIES CREATED YET //</div>
      <p class="text-xs text-dust mt-2">Initialize the timeline by clicking the start button above.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <GalleryCard
        v-for="g in galleries"
        :key="g.id"
        :title="g.display_name"
        :subtitle="g.year_month"
        zone="DIGITAL"
        :photo-count="g.photo_count"
        :contributor-count="g.contributor_count"
        :cover-photo="g.cover_photo_url"
        @click="$router.push(`/digital/${g.year_month}`)"
      />
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useDigitalStore } from '@/stores/digital';
import GalleryCard from '@/components/GalleryCard.vue';

export default {
  name: 'DigitalMonthlyTimeline',
  components: {
    GalleryCard
  },
  setup() {
    const digitalStore = useDigitalStore();
    const router = useRouter();
    const creating = ref(false);

    const galleries = computed(() => digitalStore.galleries);
    const loading = computed(() => digitalStore.loading);

    const getYearMonthString = () => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const getDisplayNameString = () => {
      const d = new Date();
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const currentMonthStr = getYearMonthString();
    const currentMonthName = getDisplayNameString();

    const currentMonthExists = computed(() => {
      return galleries.value.some(g => g.year_month === currentMonthStr);
    });

    onMounted(() => {
      digitalStore.fetchGalleries();
    });

    const startCurrentMonthGallery = async () => {
      creating.value = true;
      try {
        const result = await digitalStore.createGallery({
          year_month: currentMonthStr,
          display_name: currentMonthName
        });

        // Redirect to detail page (either newly created or existing 409 conflict redirect)
        const targetYearMonth = result.conflict ? currentMonthStr : result.year_month;
        router.push(`/digital/${targetYearMonth}`);
      } catch (err) {
        alert('Failed to initialize monthly gallery: ' + err.message);
      } finally {
        creating.value = false;
      }
    };

    return {
      galleries,
      loading,
      creating,
      currentMonthStr,
      currentMonthName,
      currentMonthExists,
      startCurrentMonthGallery
    };
  }
};
</script>
