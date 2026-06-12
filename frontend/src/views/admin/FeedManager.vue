<template>
  <div class="space-y-8 select-text">
    <header class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gridColor pb-6 gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
          FEED CURATION COCKPIT
        </h2>
        <p class="text-xs font-body text-fog mt-1">
          Manage, sort, and curate published frames and drafts. Drag rows to reorder.
        </p>
      </div>

      <div class="flex gap-2 select-none self-end sm:self-auto">
        <button class="btn btn--sm" @click="showLibraryModal = true">
          [ + CURATE FROM LIBRARY ]
        </button>
        <button class="btn btn--sm" :disabled="saving" @click="saveChanges">
          <span v-if="saving">SAVING<span class="cursor">_</span></span>
          <span v-else>[ COMMIT CHANGES ]</span>
        </button>
      </div>
    </header>

    <!-- Bulk Action Toolbar -->
    <div v-if="selectedIds.length > 0" class="flex items-center gap-3 p-3 border border-neon-red/50 bg-neon-red/5 select-none text-xs font-label">
      <span class="text-neon-red font-bold">{{ selectedIds.length }} FRAMES SELECTED //</span>
      <button class="btn btn--ghost btn--sm py-1" @click="bulkUnpublish">[ BULK UNPUBLISH ]</button>
      <button class="btn btn--danger btn--sm py-1" @click="bulkDelete">[ BULK SCRAP ]</button>
      <button class="ml-auto text-[10px] text-dust hover:underline" @click="selectedIds = []">[ CLEAR SELECTION ]</button>
    </div>

    <!-- Table -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      QUERYING DATABASE STACKS<span class="cursor">...</span>
    </div>

    <div v-else-if="editablePhotos.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none">
      // NO PUBLIC FEED FRAMES CURRENTLY ACTIVE //
    </div>

    <div v-else class="overflow-x-auto border border-gridColor bg-surface">
      <table class="w-full text-left font-body text-xs border-collapse">
        <thead class="bg-panel/60 border-b border-gridColor font-label text-dust select-none text-[10px] uppercase">
          <tr>
            <th class="p-3 w-6">⠿</th>
            <th class="p-3 w-8"><input type="checkbox" :checked="isAllSelected" @change="toggleSelectAll" /></th>
            <th class="p-3 w-16">Frame</th>
            <th class="p-3 w-28">Origin</th>
            <th class="p-3">Caption &amp; Tags</th>
            <th class="p-3 w-20">Sort #</th>
            <th class="p-3 w-28 text-center">Status</th>
            <th class="p-3 w-16 text-right">Del</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gridColor/50">
          <tr
            v-for="(photo, idx) in editablePhotos"
            :key="photo.id"
            draggable="true"
            :class="['transition-colors duration-100', dragOverIdx === idx ? 'border-t-2 border-phosphor bg-panel/30' : 'hover:bg-panel/20']"
            @dragstart="onDragStart(idx)"
            @dragover.prevent="onDragOver(idx)"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop(idx)"
            @dragend="onDragEnd"
          >
            <!-- Drag handle -->
            <td class="p-3 text-center text-dust cursor-grab active:cursor-grabbing select-none text-base leading-none">⠿</td>
            <!-- Select -->
            <td class="p-3"><input type="checkbox" :value="photo.id" v-model="selectedIds" /></td>
            <!-- Thumbnail -->
            <td class="p-3 select-none">
              <img :src="getThumbUrl(photo)" class="w-12 h-12 border border-gridColor object-cover" alt="thumb" />
            </td>
            <!-- Origin -->
            <td class="p-3 text-[10px] text-fog leading-relaxed uppercase">
              <div>{{ photo.zone }}</div>
              <div class="text-dust text-[9px] truncate max-w-[110px]">{{ photo.analog_gallery_title || photo.digital_gallery_name || 'N/A' }}</div>
            </td>
            <!-- Caption + Tags -->
            <td class="p-3 space-y-2">
              <input
                v-model="photo.caption"
                class="w-full bg-void border border-gridColor/60 p-1.5 focus:border-phosphor focus:outline-none text-chrome"
                placeholder="Empty caption..."
              />
              <!-- Tag pills -->
              <div class="flex flex-wrap gap-1 items-center">
                <span
                  v-for="tag in getPhotoTags(photo)"
                  :key="tag.id"
                  class="tag text-[9px] flex items-center gap-1 py-0.5"
                >
                  {{ tag.name }}
                  <button class="text-neon-red hover:underline leading-none ml-0.5" @click="removePhotoTag(photo, tag.id)">×</button>
                </span>
                <select
                  v-if="availableTagsForPhoto(photo).length > 0"
                  class="bg-panel border border-gridColor text-fog font-body text-[10px] px-2 py-0.5 max-w-[100px]"
                  @change="addPhotoTag(photo, $event)"
                >
                  <option value="" disabled selected>+ tag</option>
                  <option v-for="t in availableTagsForPhoto(photo)" :key="t.id" :value="t.id">{{ t.name }}</option>
                </select>
              </div>
            </td>
            <!-- Sort order -->
            <td class="p-3">
              <input
                v-model.number="photo.sort_order"
                type="number"
                class="w-16 bg-void border border-gridColor/60 p-1.5 focus:border-phosphor focus:outline-none text-chrome text-center"
              />
            </td>
            <!-- Status toggle -->
            <td class="p-3 text-center select-none font-label">
              <button
                :class="['btn btn--sm py-1 w-24 text-[10px]', photo.is_public ? 'border-phosphor text-phosphor' : 'border-dust text-dust']"
                @click="photo.is_public = !photo.is_public"
              >[ {{ photo.is_public ? 'PUBLIC' : 'MUTED' }} ]</button>
            </td>
            <!-- Delete -->
            <td class="p-3 text-right select-none">
              <button class="text-neon-red hover:underline text-[10px]" @click="deleteSingle(photo.id)">[ SCRAP ]</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- LIBRARY PICKER MODAL -->
    <div v-if="showLibraryModal" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showLibraryModal = false">
      <div class="demo bracket max-w-[680px] w-full bg-surface border border-gridColor p-6 flex flex-col h-[80vh]">
        <span class="br-tr"></span><span class="br-bl"></span>

        <header class="mb-4">
          <h3 class="text-white font-display text-2xl uppercase mb-1 text-shadow-phosphor">// LIBRARY PRIVATE LOG //</h3>
          <p class="text-xs font-body text-dust">Select unpublished scans from the library to queue into public feed</p>
        </header>

        <div class="flex-1 overflow-y-auto border border-gridColor p-3 bg-void">
          <div v-if="libraryLoading" class="flex items-center justify-center h-full font-body text-phosphor">
            SCANNING LOG STORAGE<span class="cursor">...</span>
          </div>
          <div v-else-if="libraryPhotos.length === 0" class="flex items-center justify-center h-full font-label text-fog">
            // NO PRIVATE LIBRARY PHOTOS DETECTED //
          </div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <div
              v-for="item in libraryPhotos"
              :key="item.id"
              :class="['relative border cursor-pointer aspect-square bg-panel overflow-hidden',
                       selectedLibraryIds.includes(item.id) ? 'border-phosphor shadow-[0_0_4px_#00FF94]' : 'border-gridColor hover:border-dust']"
              @click="toggleLibrarySelect(item)"
            >
              <img :src="getThumbUrl(item)" class="w-full h-full object-cover" alt="library thumb" />
              <div class="absolute bottom-0 left-0 right-0 bg-void/80 p-1 text-[8px] font-body text-dust truncate">
                {{ item.zone.toUpperCase() }} // {{ item.filename.split('/').pop() }}
              </div>
            </div>
          </div>
        </div>

        <div class="flex justify-between items-center mt-4 border-t border-gridColor/50 pt-4 select-none">
          <span class="text-xs font-body text-fog">{{ selectedLibraryPhotos.length }} SELECTIONS QUEUED</span>
          <div class="flex gap-2">
            <button class="btn btn--ghost text-xs" @click="showLibraryModal = false">[ CLOSE ]</button>
            <button class="btn text-xs" :disabled="selectedLibraryPhotos.length === 0" @click="publishLibrarySelections">
              [ STAGE SELECTIONS ]
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, watch } from 'vue';
import { useAdminStore } from '@/stores/admin';

export default {
  name: 'FeedManager',
  setup() {
    const adminStore = useAdminStore();
    const saving = ref(false);
    const selectedIds = ref([]);
    const editablePhotos = ref([]);

    const showLibraryModal = ref(false);
    const libraryLoading = ref(false);
    const libraryPhotos = ref([]);
    const selectedLibraryPhotos = ref([]);

    // Drag-and-drop state
    const dragSourceIdx = ref(null);
    const dragOverIdx = ref(null);

    const feedPhotos = computed(() => adminStore.feedPhotos);
    const loading = computed(() => adminStore.loading);
    const allTags = computed(() => adminStore.tags);

    const isAllSelected = computed(() =>
      editablePhotos.value.length > 0 && selectedIds.value.length === editablePhotos.value.length
    );
    const selectedLibraryIds = computed(() => selectedLibraryPhotos.value.map(p => p.id));

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    onMounted(async () => {
      await Promise.all([loadFeed(), adminStore.fetchTags()]);
    });

    const loadFeed = async () => {
      await adminStore.fetchFeedPhotos(1, 100);
      editablePhotos.value = JSON.parse(JSON.stringify(feedPhotos.value)).map(p => ({
        ...p,
        tags: parseTags(p.tags)
      }));
    };

    const parseTags = (tags) => {
      if (!tags) return [];
      if (typeof tags === 'string') {
        try { return JSON.parse(tags); } catch { return []; }
      }
      return Array.isArray(tags) ? tags : [];
    };

    const getThumbUrl = (photo) => {
      if (!photo.thumbnail) return '';
      if (photo.thumbnail.startsWith('http')) return photo.thumbnail;
      return `${apiBase}/uploads/${photo.thumbnail}`;
    };

    const getPhotoTags = (photo) => parseTags(photo.tags);

    const availableTagsForPhoto = (photo) => {
      const currentIds = getPhotoTags(photo).map(t => t.id);
      return allTags.value.filter(t => !currentIds.includes(t.id));
    };

    const addPhotoTag = (photo, event) => {
      const tagId = parseInt(event.target.value, 10);
      const tag = allTags.value.find(t => t.id === tagId);
      if (tag) {
        const tags = parseTags(photo.tags);
        tags.push(tag);
        photo.tags = tags;
      }
      event.target.value = '';
    };

    const removePhotoTag = (photo, tagId) => {
      photo.tags = parseTags(photo.tags).filter(t => t.id !== tagId);
    };

    // Drag-and-drop handlers
    const onDragStart = (idx) => {
      dragSourceIdx.value = idx;
    };

    const onDragOver = (idx) => {
      if (dragSourceIdx.value !== null && dragSourceIdx.value !== idx) {
        dragOverIdx.value = idx;
      }
    };

    const onDragLeave = () => {
      dragOverIdx.value = null;
    };

    const onDrop = (targetIdx) => {
      if (dragSourceIdx.value === null || dragSourceIdx.value === targetIdx) return;
      const moved = editablePhotos.value.splice(dragSourceIdx.value, 1)[0];
      editablePhotos.value.splice(targetIdx, 0, moved);
      editablePhotos.value.forEach((p, i) => { p.sort_order = i; });
      dragSourceIdx.value = null;
      dragOverIdx.value = null;
    };

    const onDragEnd = () => {
      dragSourceIdx.value = null;
      dragOverIdx.value = null;
    };

    const toggleSelectAll = (e) => {
      selectedIds.value = e.target.checked ? editablePhotos.value.map(p => p.id) : [];
    };

    const deleteSingle = async (id) => {
      if (confirm('CRITICAL WARN: HARD SCRAP THIS SCAN? THIS CANNOT BE UNDONE.')) {
        await adminStore.hardDeletePhoto(id);
        await loadFeed();
      }
    };

    const saveChanges = async () => {
      saving.value = true;
      try {
        const origById = Object.fromEntries(feedPhotos.value.map(p => [p.id, p]));
        for (const item of editablePhotos.value) {
          const orig = origById[item.id];
          const itemTags = parseTags(item.tags);
          const origTags = parseTags(orig?.tags);
          const tagsChanged = JSON.stringify(itemTags.map(t => t.id).sort()) !== JSON.stringify(origTags.map(t => t.id).sort());

          if (
            orig?.caption !== item.caption ||
            orig?.sort_order !== item.sort_order ||
            orig?.is_public !== item.is_public ||
            tagsChanged
          ) {
            await adminStore.updatePhotoCuration(item.id, {
              caption: item.caption,
              sort_order: item.sort_order,
              is_public: item.is_public,
              tagIds: itemTags.map(t => t.id)
            });
          }
        }
        await loadFeed();
        alert('Curation database updates committed successfully.');
      } catch (err) {
        alert('Commit Failure: ' + err.message);
      } finally {
        saving.value = false;
      }
    };

    const bulkUnpublish = async () => {
      try {
        for (const id of selectedIds.value) {
          await adminStore.updatePhotoCuration(id, { is_public: false });
        }
        selectedIds.value = [];
        await loadFeed();
      } catch (err) {
        alert('Bulk unpublish failure: ' + err.message);
      }
    };

    const bulkDelete = async () => {
      if (confirm(`CRITICAL WARN: THIS WILL HARD SCRAP ALL ${selectedIds.value.length} SELECTED IMAGES. PROCEED?`)) {
        try {
          for (const id of selectedIds.value) {
            await adminStore.hardDeletePhoto(id);
          }
          selectedIds.value = [];
          await loadFeed();
        } catch (err) {
          alert('Bulk scrap failure: ' + err.message);
        }
      }
    };

    watch(showLibraryModal, async (isOpen) => {
      if (isOpen) {
        libraryLoading.value = true;
        selectedLibraryPhotos.value = [];
        try {
          await adminStore.fetchFeedPhotos(1, 200);
          libraryPhotos.value = adminStore.feedPhotos.filter(p => !p.is_public);
        } catch (err) {
          console.error(err);
        } finally {
          libraryLoading.value = false;
        }
      } else {
        await loadFeed();
      }
    });

    const toggleLibrarySelect = (item) => {
      const idx = selectedLibraryPhotos.value.findIndex(p => p.id === item.id);
      if (idx === -1) selectedLibraryPhotos.value.push(item);
      else selectedLibraryPhotos.value.splice(idx, 1);
    };

    const publishLibrarySelections = async () => {
      try {
        for (const item of selectedLibraryPhotos.value) {
          await adminStore.updatePhotoCuration(item.id, { is_public: true });
        }
        showLibraryModal.value = false;
        await loadFeed();
      } catch (err) {
        alert('Curation staging failure: ' + err.message);
      }
    };

    return {
      saving,
      selectedIds,
      editablePhotos,
      loading,
      isAllSelected,
      allTags,
      dragOverIdx,
      getThumbUrl,
      getPhotoTags,
      availableTagsForPhoto,
      addPhotoTag,
      removePhotoTag,
      toggleSelectAll,
      deleteSingle,
      saveChanges,
      bulkUnpublish,
      bulkDelete,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd,
      showLibraryModal,
      libraryLoading,
      libraryPhotos,
      selectedLibraryPhotos,
      selectedLibraryIds,
      toggleLibrarySelect,
      publishLibrarySelections
    };
  }
};
</script>
