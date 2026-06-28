<template>
  <div class="space-y-8 select-text">
    <header class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gridColor pb-6 gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
          FEED CURATION COCKPIT
        </h2>
        <p class="text-xs font-body text-fog mt-1">
          Published frames only. Push photos to feed from the gallery admin view.
        </p>
      </div>

      <div class="flex gap-2 select-none self-end sm:self-auto">
        <router-link to="/admin/analog" class="btn btn--ghost btn--sm text-xs">
          [ ◀ GO TO GALLERIES ]
        </router-link>
        <button class="btn btn--sm text-xs" :disabled="saving" @click="saveChanges">
          <span v-if="saving">SAVING<span class="cursor">_</span></span>
          <span v-else>[ COMMIT CHANGES ]</span>
        </button>
      </div>
    </header>

    <!-- Bulk Action Toolbar -->
    <div v-if="selectedIds.length > 0" class="flex items-center gap-3 p-3 border border-neon-red/50 bg-neon-red/5 select-none text-xs font-label">
      <span class="text-neon-red font-bold">{{ selectedIds.length }} FRAMES SELECTED //</span>
      <button class="btn btn--ghost btn--sm py-1" @click="bulkUnpublish">[ BULK UNPUBLISH ]</button>
      <button class="ml-auto text-[10px] text-dust hover:underline" @click="selectedIds = []">[ CLEAR SELECTION ]</button>
    </div>

    <!-- Table -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      QUERYING DATABASE STACKS<span class="cursor">...</span>
    </div>

    <div v-else-if="editablePhotos.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none space-y-2">
      <div>// NO FRAMES PUBLISHED TO FEED YET //</div>
      <div class="text-dust">Navigate to a gallery in the admin panel and use the <span class="text-chrome">FEED</span> button on any photo.</div>
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
            <td class="p-3 text-center text-dust cursor-grab active:cursor-grabbing select-none text-base leading-none">⠿</td>
            <td class="p-3"><input type="checkbox" :value="photo.id" v-model="selectedIds" /></td>
            <td class="p-3 select-none">
              <img :src="getThumbUrl(photo)" class="w-12 h-12 border border-gridColor object-cover" alt="thumb" />
            </td>
            <td class="p-3 text-[10px] text-fog leading-relaxed uppercase">
              <div>{{ photo.zone }}</div>
              <div class="text-dust text-[9px] truncate max-w-[110px]">{{ photo.analog_gallery_title || photo.digital_gallery_name || 'N/A' }}</div>
            </td>
            <td class="p-3 space-y-2">
              <input
                v-model="photo.caption"
                class="w-full bg-void border border-gridColor/60 p-1.5 focus:border-phosphor focus:outline-none text-chrome"
                placeholder="Empty caption..."
              />
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
            <td class="p-3">
              <input
                v-model.number="photo.sort_order"
                type="number"
                class="w-16 bg-void border border-gridColor/60 p-1.5 focus:border-phosphor focus:outline-none text-chrome text-center"
              />
            </td>
            <td class="p-3 text-center select-none font-label">
              <button
                :class="['btn btn--sm py-1 w-24 text-[10px]', photo.is_public ? 'border-phosphor text-phosphor' : 'border-dust text-dust']"
                @click="photo.is_public = !photo.is_public"
              >[ {{ photo.is_public ? 'PUBLIC' : 'MUTED' }} ]</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';

export default {
  name: 'FeedManager',
  setup() {
    const adminStore = useAdminStore();
    const saving = ref(false);
    const selectedIds = ref([]);
    const editablePhotos = ref([]);
    const dragSourceIdx = ref(null);
    const dragOverIdx = ref(null);

    const feedPhotos = computed(() => adminStore.feedPhotos);
    const loading = computed(() => adminStore.loading);
    const allTags = computed(() => adminStore.tags);

    const isAllSelected = computed(() =>
      editablePhotos.value.length > 0 && selectedIds.value.length === editablePhotos.value.length
    );

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');

    onMounted(async () => {
      await Promise.all([loadFeed(), adminStore.fetchTags()]);
    });

    const loadFeed = async () => {
      // Always load only published feed photos
      await adminStore.fetchFeedPhotos(1, 200, true);
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

    const onDragStart = (idx) => { dragSourceIdx.value = idx; };
    const onDragOver = (idx) => {
      if (dragSourceIdx.value !== null && dragSourceIdx.value !== idx) dragOverIdx.value = idx;
    };
    const onDragLeave = () => { dragOverIdx.value = null; };
    const onDrop = (targetIdx) => {
      if (dragSourceIdx.value === null || dragSourceIdx.value === targetIdx) return;
      const moved = editablePhotos.value.splice(dragSourceIdx.value, 1)[0];
      editablePhotos.value.splice(targetIdx, 0, moved);
      editablePhotos.value.forEach((p, i) => { p.sort_order = i; });
      dragSourceIdx.value = null;
      dragOverIdx.value = null;
    };
    const onDragEnd = () => { dragSourceIdx.value = null; dragOverIdx.value = null; };

    const toggleSelectAll = (e) => {
      selectedIds.value = e.target.checked ? editablePhotos.value.map(p => p.id) : [];
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
      } catch (err) {
        alert('Commit failure: ' + err.message);
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

    return {
      saving, selectedIds, editablePhotos, loading, isAllSelected, allTags, dragOverIdx,
      getThumbUrl, getPhotoTags, availableTagsForPhoto, addPhotoTag, removePhotoTag,
      toggleSelectAll, saveChanges, bulkUnpublish,
      onDragStart, onDragOver, onDragLeave, onDrop, onDragEnd
    };
  }
};
</script>
