<template>
  <div class="space-y-8 select-text">
    <header class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gridColor pb-6 gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
          ANALOG ARCHIVE MANAGEMENT
        </h2>
        <p class="text-xs font-body text-fog mt-1">
          Review, index, and organize physical film rolls metadata.
        </p>
      </div>

      <!-- Add Roll Button -->
      <div class="select-none self-end sm:self-auto">
        <button class="btn btn--sm" @click="openCreateModal">
          [ + CREATE FILM ROLL ]
        </button>
      </div>
    </header>

    <!-- Galleries Table -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      SCANNING DATABASE SEGMENTS<span class="cursor">...</span>
    </div>

    <div v-else-if="galleries.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none">
      // NO ANALOG ROLL ARCHIVES REGISTERED IN DATABASE //
    </div>

    <div v-else class="overflow-x-auto border border-gridColor bg-surface">
      <table class="w-full text-left font-body text-xs border-collapse">
        <thead class="bg-panel/60 border-b border-gridColor font-label text-dust select-none text-[10px] uppercase">
          <tr>
            <th class="p-3 w-16 text-center">ID</th>
            <th class="p-3 w-20 text-center">Status</th>
            <th class="p-3">Roll Title</th>
            <th class="p-3">Camera &amp; Film Stock</th>
            <th class="p-3 w-28 text-center">Frames</th>
            <th class="p-3">Tags Assigned</th>
            <th class="p-3 w-56 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gridColor/50">
          <tr v-for="g in galleries" :key="g.id" class="hover:bg-panel/20">
            <!-- ID -->
            <td class="p-3 text-center font-label text-dust">
              #{{ String(g.id).padStart(3, '0') }}
            </td>
            <!-- Status -->
            <td class="p-3 text-center select-none">
              <span :class="['font-label text-[9px] px-1.5 py-0.5 border', g.is_published ? 'bg-phosphor/10 text-phosphor border-phosphor/30' : 'bg-panel/60 text-dust/60 border-dust/20']">
                {{ g.is_published ? 'LIVE' : 'DRAFT' }}
              </span>
            </td>
            <!-- Title -->
            <td class="p-3">
              <router-link :to="`/admin/analog/${g.id}`" class="text-white font-medium hover:text-phosphor uppercase">
                {{ g.title }}
              </router-link>
              <div class="text-[10px] text-dust">{{ g.year }}.{{ String(g.month).padStart(2, '0') }}</div>
            </td>
            <!-- Camera & Film -->
            <td class="p-3 text-[10px] text-fog leading-relaxed uppercase">
              <div><span class="font-label text-[9px] text-phosphor">CAM //</span> {{ g.camera }}</div>
              <div class="text-dust mt-0.5"><span class="font-label text-[9px] text-dust">FILM //</span> {{ g.film_stock }}</div>
            </td>
            <!-- Count -->
            <td class="p-3 text-center font-label text-chrome">
              {{ g.photo_count }}
            </td>
            <!-- Tags -->
            <td class="p-3 select-none">
              <div class="flex flex-wrap gap-1">
                <TagBadge v-for="t in g.tags" :key="t.id" :name="t.name" :color="t.color" />
              </div>
            </td>
            <!-- Actions -->
            <td class="p-3 text-right select-none font-label space-x-3">
              <router-link :to="`/admin/analog/${g.id}`" class="text-phosphor hover:underline text-[10px]">
                [ OPEN ]
              </router-link>
              <button
                :class="['text-[10px] hover:underline', g.is_published ? 'text-dust' : 'text-chrome']"
                :disabled="togglingPublishId === g.id"
                @click="handleTogglePublish(g)"
              >
                <span v-if="togglingPublishId === g.id">...</span>
                <span v-else>{{ g.is_published ? '[ UNPUBLISH ]' : '[ PUBLISH ]' }}</span>
              </button>
              <button class="text-dust hover:text-chrome hover:underline text-[10px]" @click="openEditModal(g)">
                [ EDIT ]
              </button>
              <button class="text-neon-red hover:underline text-[10px]" @click="confirmDeleteRoll(g)">
                [ SCRAP ]
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CREATE / EDIT MODAL (REUSED FORM) -->
    <div v-if="showModal" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showModal = false">
      <div class="demo bracket max-w-[500px] w-full bg-surface border border-gridColor p-6">
        <span class="br-tr"></span><span class="br-bl"></span>
        <h3 class="text-white font-display text-2xl uppercase mb-6 text-shadow-phosphor">
          // {{ isEditMode ? 'EDIT' : 'CREATE' }} ANALOG ROLL //
        </h3>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Roll Title</label>
              <div class="tinput"><input v-model="form.title" required placeholder="e.g. Tokyo Neon" /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Camera Body</label>
              <div class="tinput"><input v-model="form.camera" required placeholder="e.g. Canon AE-1" /></div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="col-span-2">
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Film Stock</label>
              <div class="tinput"><input v-model="form.film_stock" required placeholder="e.g. HP5 Plus" /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Month (1-12)</label>
              <div class="tinput"><input v-model.number="form.month" type="number" min="1" max="12" required /></div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Year</label>
              <div class="tinput"><input v-model.number="form.year" type="number" min="1900" max="2100" required /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Tags (comma separated)</label>
              <div class="tinput"><input v-model="form.tagsInput" placeholder="street, night" /></div>
            </div>
          </div>

          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Notes</label>
            <div class="tinput"><textarea v-model="form.notes" placeholder="Optional roll notes..."></textarea></div>
          </div>

          <div class="flex justify-end gap-3 pt-4 select-none">
            <button type="button" class="btn btn--ghost text-xs" @click="showModal = false">[ CANCEL ]</button>
            <button type="submit" class="btn text-xs">[ {{ isEditMode ? 'UPDATE' : 'TRANSMIT' }} ]</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAnalogStore } from '@/stores/analog';
import { useAdminStore } from '@/stores/admin';
import TagBadge from '@/components/TagBadge.vue';

export default {
  name: 'AdminAnalogManager',
  components: {
    TagBadge
  },
  setup() {
    const analogStore = useAnalogStore();
    const adminStore = useAdminStore();

    const showModal = ref(false);
    const isEditMode = ref(false);
    const editRollId = ref(null);

    const form = ref({
      title: '',
      camera: '',
      film_stock: '',
      month: 1,
      year: 2026,
      notes: '',
      tagsInput: ''
    });

    const galleries = computed(() => analogStore.galleries);
    const loading = computed(() => analogStore.loading);

    onMounted(() => {
      analogStore.fetchGalleries();
    });

    const resetForm = () => {
      form.value = {
        title: '',
        camera: '',
        film_stock: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        notes: '',
        tagsInput: ''
      };
    };

    const openCreateModal = () => {
      resetForm();
      isEditMode.value = false;
      showModal.value = true;
    };

    const openEditModal = (roll) => {
      editRollId.value = roll.id;
      form.value = {
        title: roll.title,
        camera: roll.camera,
        film_stock: roll.film_stock,
        month: roll.month,
        year: roll.year,
        notes: roll.notes || '',
        tagsInput: roll.tags ? roll.tags.map(t => t.name).join(', ') : ''
      };
      isEditMode.value = true;
      showModal.value = true;
    };

    const submitForm = async () => {
      try {
        const tagNames = form.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds = [];

        // Check/Create tags in global system taxonomy
        if (tagNames.length > 0) {
          await adminStore.fetchTags();
          for (const name of tagNames) {
            let existing = adminStore.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (!existing) {
              existing = await adminStore.createTag({ name });
            }
            tagIds.push(existing.id);
          }
        }

        const payload = {
          title: form.value.title,
          camera: form.value.camera,
          film_stock: form.value.film_stock,
          month: form.value.month,
          year: form.value.year,
          notes: form.value.notes,
          tagIds
        };

        if (isEditMode.value) {
          await analogStore.updateGallery(editRollId.value, payload);
        } else {
          await analogStore.createGallery(payload);
        }

        showModal.value = false;
        await analogStore.fetchGalleries();
      } catch (err) {
        alert('Archival Form Error: ' + err.message);
      }
    };

    const togglingPublishId = ref(null);

    const handleTogglePublish = async (roll) => {
      togglingPublishId.value = roll.id;
      try {
        await analogStore.toggleGalleryPublished(roll.id);
      } catch (err) {
        alert('Toggle publish failed: ' + err.message);
      } finally {
        togglingPublishId.value = null;
      }
    };

    const confirmDeleteRoll = async (roll) => {
      const promptText = `CRITICAL WARN: THIS WILL PERMANENTLY SCRAP '${roll.title}' AND ALL ATTACHED ${roll.photo_count} SCAN FRAMES. PROCEED?`;
      if (confirm(promptText)) {
        await analogStore.deleteGallery(roll.id);
        await analogStore.fetchGalleries();
      }
    };

    return {
      showModal,
      isEditMode,
      form,
      galleries,
      loading,
      togglingPublishId,
      openCreateModal,
      openEditModal,
      submitForm,
      confirmDeleteRoll,
      handleTogglePublish
    };
  }
};
</script>
