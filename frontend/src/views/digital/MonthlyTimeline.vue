<template>
  <div class="wrap py-12">
    <!-- Header -->
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

      <!-- Action buttons -->
      <div class="flex flex-wrap gap-2 select-none self-end md:self-auto">
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
        <button class="btn btn--ghost text-xs" @click="showPicker = !showPicker">
          [ OPEN OTHER MONTH ]
        </button>
      </div>
    </header>

    <!-- Month picker for any month -->
    <div v-if="showPicker" class="border border-gridColor bg-surface p-5 space-y-3 mb-8">
      <h3 class="text-[10px] font-label text-dust uppercase select-none">// OPEN OR CREATE A SPECIFIC MONTH</h3>
      <form class="flex flex-wrap gap-3 items-end" @submit.prevent="openMonth">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-label text-dust uppercase">Year</label>
          <input v-model.number="picker.year" type="number" min="2000" :max="new Date().getFullYear()" required class="tinput w-24" />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-label text-dust uppercase">Month</label>
          <select v-model.number="picker.month" required class="tinput w-36">
            <option v-for="(name, idx) in monthNames" :key="idx" :value="idx + 1">
              {{ String(idx + 1).padStart(2, '0') }} — {{ name }}
            </option>
          </select>
        </div>
        <button type="submit" class="btn btn--sm text-xs" :disabled="creating">
          {{ creating ? '[ OPENING... ]' : '[ GO ]' }}
        </button>
      </form>
      <p v-if="pickerError" class="text-xs font-body text-neon-red">{{ pickerError }}</p>
    </div>

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

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];

export default {
  name: 'DigitalMonthlyTimeline',
  components: { GalleryCard },
  setup() {
    const digitalStore = useDigitalStore();
    const router = useRouter();
    const creating = ref(false);
    const showPicker = ref(false);
    const pickerError = ref('');
    const now = new Date();
    const picker = ref({ year: now.getFullYear(), month: now.getMonth() + 1 });

    const galleries = computed(() => digitalStore.galleries);
    const loading = computed(() => digitalStore.loading);

    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    const currentMonthExists = computed(() =>
      galleries.value.some(g => g.year_month === currentMonthStr)
    );

    onMounted(() => { digitalStore.fetchGalleries(); });

    const startCurrentMonthGallery = async () => {
      creating.value = true;
      try {
        const result = await digitalStore.createGallery({
          year_month: currentMonthStr,
          display_name: currentMonthName
        });
        router.push(`/digital/${result.conflict ? currentMonthStr : result.year_month}`);
      } catch (err) {
        alert('Failed to initialize monthly gallery: ' + err.message);
      } finally {
        creating.value = false;
      }
    };

    const openMonth = async () => {
      pickerError.value = '';
      const yearMonth = `${picker.value.year}-${String(picker.value.month).padStart(2, '0')}`;
      const displayName = `${MONTH_NAMES[picker.value.month - 1]} ${picker.value.year}`;

      const existing = galleries.value.find(g => g.year_month === yearMonth);
      if (existing) {
        router.push(`/digital/${yearMonth}`);
        return;
      }

      creating.value = true;
      try {
        const result = await digitalStore.createGallery({ year_month: yearMonth, display_name: displayName });
        router.push(`/digital/${result.conflict ? yearMonth : result.year_month}`);
      } catch (err) {
        pickerError.value = err.response?.data?.error || err.message;
      } finally {
        creating.value = false;
      }
    };

    return {
      galleries, loading, creating,
      currentMonthStr, currentMonthName, currentMonthExists,
      startCurrentMonthGallery,
      showPicker, picker, pickerError, openMonth,
      monthNames: MONTH_NAMES
    };
  }
};
</script>
