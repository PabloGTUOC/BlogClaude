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

    <!-- Create Gallery Form -->
    <div class="border border-gridColor bg-surface p-5 space-y-4">
      <h3 class="text-xs font-label text-dust uppercase select-none">// CREATE MONTHLY GALLERY</h3>
      <form class="flex flex-wrap gap-3 items-end" @submit.prevent="createGallery">
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-label text-dust uppercase">Year</label>
          <input
            v-model.number="form.year"
            type="number"
            min="2000"
            :max="new Date().getFullYear()"
            required
            class="tinput w-24"
          />
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-label text-dust uppercase">Month</label>
          <select v-model.number="form.month" required class="tinput w-36">
            <option v-for="(name, idx) in monthNames" :key="idx" :value="idx + 1">
              {{ String(idx + 1).padStart(2, '0') }} — {{ name }}
            </option>
          </select>
        </div>
        <div class="flex flex-col gap-1">
          <label class="text-[10px] font-label text-dust uppercase">Display Name</label>
          <input
            v-model="form.displayName"
            type="text"
            maxlength="50"
            required
            class="tinput w-48"
            placeholder="e.g. January 2025"
          />
        </div>
        <button type="submit" class="btn btn--sm text-xs" :disabled="creating">
          {{ creating ? '[ CREATING... ]' : '[ CREATE GALLERY ]' }}
        </button>
      </form>
      <p v-if="createError" class="text-xs font-body text-neon-red">{{ createError }}</p>
    </div>

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
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useDigitalStore } from '@/stores/digital';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default {
  name: 'AdminDigitalManager',
  setup() {
    const digitalStore = useDigitalStore();
    const router = useRouter();
    const galleries = computed(() => digitalStore.galleries);
    const loading = computed(() => digitalStore.loading);
    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    const now = new Date();
    const form = ref({
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      displayName: `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`
    });
    const creating = ref(false);
    const createError = ref('');

    // Auto-update display name when year/month changes
    watch([() => form.value.year, () => form.value.month], ([y, m]) => {
      if (m >= 1 && m <= 12 && y >= 2000) {
        form.value.displayName = `${MONTH_NAMES[m - 1]} ${y}`;
      }
    });

    onMounted(() => {
      digitalStore.fetchGalleries();
    });

    const getThumbUrl = (url) => {
      if (!url) return '';
      if (url.startsWith('http')) return url;
      return `${apiBase}/uploads/${url}`;
    };

    const createGallery = async () => {
      createError.value = '';
      const yearMonth = `${form.value.year}-${String(form.value.month).padStart(2, '0')}`;
      creating.value = true;
      try {
        const result = await digitalStore.createGallery({
          year_month: yearMonth,
          display_name: form.value.displayName
        });
        if (result.conflict) {
          router.push(`/digital/${yearMonth}`);
        } else {
          router.push(`/digital/${result.year_month}`);
        }
      } catch (err) {
        createError.value = err.response?.data?.error || err.message;
      } finally {
        creating.value = false;
      }
    };

    return {
      galleries,
      loading,
      getThumbUrl,
      form,
      creating,
      createError,
      createGallery,
      monthNames: MONTH_NAMES
    };
  }
};
</script>
