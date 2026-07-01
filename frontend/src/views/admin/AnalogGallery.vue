<template>
  <div class="space-y-6 select-text">
    <!-- Header -->
    <header class="border-b border-gridColor pb-6 space-y-4">
      <router-link to="/admin/analog" class="btn btn--ghost btn--sm text-xs select-none inline-block">
        [ ◀ ANALOG INDEX ]
      </router-link>

      <!-- VIEW MODE -->
      <div v-if="!editingMeta" class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-baseline gap-3 flex-wrap">
            <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
              ROLL #{{ padId(gallery?.id) }}: {{ gallery?.title || '...' }}
            </h2>
            <button v-if="gallery" class="btn btn--ghost btn--sm text-[11px] select-none" @click="startEdit">[ EDIT ]</button>
          </div>
          <GalleryMeta
            v-if="gallery"
            :camera="gallery.camera"
            :film-stock="gallery.film_stock"
            :month="gallery.month"
            :year="gallery.year"
            :tags="parsedTags"
          />
        </div>
        <div class="flex gap-2 select-none self-end sm:self-start flex-wrap justify-end">
          <button
            v-if="gallery"
            :class="['btn btn--sm text-xs', gallery.is_published ? 'btn--ghost' : '']"
            :disabled="publishingGallery"
            @click="handleTogglePublish"
          >
            <span v-if="publishingGallery">UPDATING<span class="cursor">_</span></span>
            <span v-else>{{ gallery.is_published ? '[ UNPUBLISH ]' : '[ PUBLISH GALLERY ]' }}</span>
          </button>
          <button
            v-if="orderChanged"
            class="btn btn--sm text-xs"
            :disabled="savingOrder"
            @click="saveOrder"
          >
            <span v-if="savingOrder">SAVING<span class="cursor">_</span></span>
            <span v-else>[ SAVE ORDER ]</span>
          </button>
          <button class="btn btn--sm text-xs" @click="showUpload = !showUpload">
            [ {{ showUpload ? 'CLOSE UPLOADER' : '+ TRANSMIT FRAMES' }} ]
          </button>
        </div>
      </div>

      <!-- EDIT MODE (inline form) -->
      <div v-else class="space-y-4">
        <div class="text-xs font-label text-fog uppercase select-none">// EDITING ROLL #{{ padId(gallery?.id) }}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="meta-title" class="text-xs font-label text-fog uppercase block mb-1">Roll Title</label>
            <div class="tinput"><input id="meta-title" v-model="metaForm.title" placeholder="e.g. Tokyo Neon" /></div>
          </div>
          <div>
            <label for="meta-camera" class="text-xs font-label text-fog uppercase block mb-1">Camera Body</label>
            <div class="tinput"><input id="meta-camera" v-model="metaForm.camera" placeholder="e.g. Canon AE-1" /></div>
          </div>
          <div>
            <label for="meta-film" class="text-xs font-label text-fog uppercase block mb-1">Film Stock</label>
            <div class="tinput"><input id="meta-film" v-model="metaForm.film_stock" placeholder="e.g. HP5 Plus" /></div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label for="meta-month" class="text-xs font-label text-fog uppercase block mb-1">Month</label>
              <div class="tinput"><input id="meta-month" v-model.number="metaForm.month" type="number" min="1" max="12" /></div>
            </div>
            <div>
              <label for="meta-year" class="text-xs font-label text-fog uppercase block mb-1">Year</label>
              <div class="tinput"><input id="meta-year" v-model.number="metaForm.year" type="number" min="1900" max="2100" /></div>
            </div>
          </div>
        </div>
        <div>
          <label for="meta-tags" class="text-xs font-label text-fog uppercase block mb-1">Tags (comma separated)</label>
          <div class="tinput"><input id="meta-tags" v-model="metaForm.tagsInput" placeholder="street, night" /></div>
        </div>
        <div>
          <label for="meta-notes" class="text-xs font-label text-fog uppercase block mb-1">Notes</label>
          <div class="tinput"><textarea id="meta-notes" v-model="metaForm.notes" rows="2" placeholder="Optional roll notes..."></textarea></div>
        </div>
        <div class="flex gap-3 select-none">
          <button class="btn btn--ghost text-xs" @click="cancelEdit">[ CANCEL ]</button>
          <button class="btn text-xs" :disabled="savingMeta" @click="saveMeta">
            <span v-if="savingMeta">SAVING<span class="cursor">_</span></span>
            <span v-else>[ SAVE ROLL ]</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Upload drawer -->
    <div v-if="showUpload" class="p-6 border border-gridColor bg-surface/50">
      <h4 class="text-xs font-label text-fog uppercase mb-3 select-none">// TRANSMIT SCANS TO THIS ROLL</h4>
      <UploadZone @files-uploaded="handleUpload" />
    </div>

    <!-- Loading state -->
    <div v-if="loading && !gallery" class="flex items-center justify-center py-20 font-body text-phosphor">
      READING ARCHIVE SEGMENTS<span class="cursor">...</span>
    </div>

    <div v-else-if="error" class="font-label text-xs text-neon-red py-10 border border-neon-red/30 p-4">
      // TRANSMISSION ERROR: {{ error }}
    </div>

    <!-- Contact Sheet -->
    <div v-else>
      <div class="flex items-center justify-between mb-3 select-none">
        <h3 class="font-label text-xs text-fog uppercase">// CONTACT SHEET ({{ editablePhotos.length }} FRAMES)</h3>
        <div class="flex items-center gap-4 text-[11px] font-label text-fog">
          <span v-if="galleryPhotos.length > 0" class="text-phosphor/80">{{ galleryPhotos.length }} IN GALLERY</span>
          <span v-if="editablePhotos.length > 1">DRAG OR ◀ ▶ TO REORDER</span>
        </div>
      </div>

      <div v-if="editablePhotos.length === 0" class="text-xs font-body text-fog py-16 border border-dashed border-gridColor/60 text-center select-none">
        // NO FRAMES ON THIS ROLL YET — TRANSMIT SCANS ABOVE //
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
        <div
          v-for="(photo, idx) in editablePhotos"
          :key="photo.id"
          draggable="true"
          :class="[
            'frame relative overflow-hidden',
            dragSourceIdx === idx ? 'opacity-25' : '',
            dragOverIdx === idx ? 'ring-1 ring-inset ring-phosphor' : '',
            photo.in_gallery ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
          ]"
          @dragstart="onDragStart(idx)"
          @dragover.prevent="onDragOver(idx)"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop(idx)"
          @dragend="onDragEnd"
          @click="onPhotoClick(photo)"
        >
          <img :src="thumbUrl(photo)" class="w-full aspect-square object-cover block" :alt="`frame ${idx + 1}`" loading="lazy" />

          <!-- State badges: G = in gallery, F = on feed -->
          <div class="absolute top-0 right-0 z-10 flex flex-col items-end pointer-events-none">
            <span v-if="photo.in_gallery" class="bg-phosphor text-void font-label text-[10px] leading-none px-[3px] py-[2px]">G</span>
            <span v-if="photo.is_public" class="bg-neon-red text-white font-label text-[10px] leading-none px-[3px] py-[2px]">F</span>
          </div>

          <!-- Frame actions: overlay on hover/keyboard-focus (pointer devices),
               static action bar on touch where there is no hover. -->
          <div class="frame__actions">
            <!-- Keyboard / touch reorder fallback for the drag interaction -->
            <div v-if="editablePhotos.length > 1" class="flex gap-1">
              <button
                class="flex-1 font-label text-xs leading-none py-1.5 border border-chrome/40 text-chrome hover:bg-chrome/10 transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed"
                :disabled="idx === 0"
                :aria-label="`Move frame ${idx + 1} earlier`"
                @click.stop="movePhoto(idx, -1)"
              >◀</button>
              <button
                class="flex-1 font-label text-xs leading-none py-1.5 border border-chrome/40 text-chrome hover:bg-chrome/10 transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed"
                :disabled="idx === editablePhotos.length - 1"
                :aria-label="`Move frame ${idx + 1} later`"
                @click.stop="movePhoto(idx, 1)"
              >▶</button>
            </div>
            <button
              :class="[
                'font-label text-xs leading-none py-1.5 border text-center transition-colors',
                photo.in_gallery
                  ? 'border-dust/50 text-fog hover:border-neon-red hover:text-neon-red'
                  : 'border-phosphor/50 text-phosphor hover:bg-phosphor/20'
              ]"
              @click.stop="handleToggleGallery(photo)"
            >{{ photo.in_gallery ? '— GALLERY' : '+ GALLERY' }}</button>
            <button
              v-if="!photo.is_public"
              class="font-label text-xs leading-none py-1.5 border border-amber/60 text-amber hover:bg-amber/10 transition-colors text-center"
              @click.stop="openPublishModal(photo)"
            >+ FEED</button>
            <button
              v-else
              class="font-label text-xs leading-none py-1.5 border border-dust/40 text-fog hover:bg-dust/20 transition-colors text-center"
              @click.stop="handleUnpublish(photo)"
            >— FEED</button>
            <button
              class="font-label text-xs leading-none py-1.5 border border-neon-red/50 text-neon-red hover:bg-neon-red/20 transition-colors text-center"
              @click.stop="handleDelete(photo)"
            >DELETE</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Publish to Feed Modal -->
    <TerminalModal v-model="publishModal.show" title="// PUBLISH TO FEED //" max-width="500px">
      <p class="text-xs font-body text-fog -mt-3 mb-6">Frame will be added to the public photo feed.</p>

      <img v-if="publishModal.photo" :src="thumbUrl(publishModal.photo)" class="w-full max-h-48 object-contain border border-gridColor mb-5" alt="Frame to publish" loading="lazy" />

      <div class="space-y-4">
        <div>
          <label for="publish-caption" class="text-xs font-label text-fog uppercase block mb-1">Caption</label>
          <div class="tinput"><input id="publish-caption" v-model="publishModal.caption" placeholder="Optional caption..." /></div>
        </div>
        <div>
          <label for="publish-tags" class="text-xs font-label text-fog uppercase block mb-1">Tags</label>
          <div class="flex flex-wrap gap-2 mb-2">
            <span
              v-for="tag in publishModal.selectedTags"
              :key="tag.id"
              class="tag text-xs flex items-center gap-1"
            >
              {{ tag.name }}
              <button type="button" class="text-neon-red hover:underline leading-none" :aria-label="`Remove tag ${tag.name}`" @click="removePublishTag(tag.id)">×</button>
            </span>
          </div>
          <div class="tinput">
            <span class="tinput__prompt">+</span>
            <select id="publish-tags" class="flex-1 bg-transparent border-none outline-none text-chrome font-body text-sm" @change="addPublishTag($event)">
              <option value="" disabled selected>add tag...</option>
              <option v-for="t in availablePublishTags" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6 select-none">
        <button type="button" class="btn btn--ghost text-xs" @click="publishModal.show = false">[ CANCEL ]</button>
        <button type="button" class="btn text-xs" :disabled="publishModal.submitting" @click="submitPublish">
          <span v-if="publishModal.submitting">TRANSMITTING<span class="cursor">_</span></span>
          <span v-else>[ PUBLISH ]</span>
        </button>
      </div>
    </TerminalModal>

    <!-- Lightbox: only for in_gallery photos -->
    <Lightbox
      :photo="lightboxPhoto"
      :is-open="lightboxOpen"
      :show-nav="galleryPhotos.length > 1"
      @close="lightboxOpen = false"
      @prev="navigateLightbox(-1)"
      @next="navigateLightbox(1)"
    />
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useAnalogStore } from '@/stores/analog';
import { useAdminStore } from '@/stores/admin';
import { useUiStore } from '@/stores/ui';
import GalleryMeta from '@/components/GalleryMeta.vue';
import UploadZone from '@/components/UploadZone.vue';
import Lightbox from '@/components/Lightbox.vue';
import TerminalModal from '@/components/TerminalModal.vue';

export default {
  name: 'AdminAnalogGallery',
  components: {
    GalleryMeta,
    UploadZone,
    Lightbox,
    TerminalModal
  },
  setup() {
    const route = useRoute();
    const analogStore = useAnalogStore();
    const adminStore = useAdminStore();
    const ui = useUiStore();

    const error = ref(null);
    const loading = ref(true);
    const showUpload = ref(false);

    // Drag / reorder state
    const editablePhotos = ref([]);
    const dragSourceIdx = ref(null);
    const dragOverIdx = ref(null);
    const orderChanged = ref(false);
    const savingOrder = ref(false);

    // Inline meta edit state
    const editingMeta = ref(false);
    const savingMeta = ref(false);
    const metaForm = ref({ title: '', camera: '', film_stock: '', month: 1, year: 2026, notes: '', tagsInput: '' });

    // Gallery publish toggle
    const publishingGallery = ref(false);

    // Lightbox
    const lightboxOpen = ref(false);
    const lightboxIdx = ref(0);

    // Publish to feed modal
    const publishModal = ref({ show: false, photo: null, caption: '', selectedTags: [], submitting: false });

    const gallery = computed(() => analogStore.currentGallery);
    const allTags = computed(() => adminStore.tags);

    watch(() => analogStore.currentPhotos, (newPhotos) => {
      editablePhotos.value = newPhotos.map(p => ({ ...p }));
      orderChanged.value = false;
    }, { immediate: true });

    const parsedTags = computed(() => {
      if (!gallery.value?.tags) return [];
      if (typeof gallery.value.tags === 'string') {
        try { return JSON.parse(gallery.value.tags); } catch { return []; }
      }
      return gallery.value.tags || [];
    });

    const galleryPhotos = computed(() => editablePhotos.value.filter(p => p.in_gallery));
    const lightboxPhoto = computed(() => galleryPhotos.value[lightboxIdx.value] || null);

    const availablePublishTags = computed(() => {
      const selectedIds = publishModal.value.selectedTags.map(t => t.id);
      return allTags.value.filter(t => !selectedIds.includes(t.id));
    });

    const apiBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api').replace('/api', '');
    const thumbUrl = (photo) => {
      if (!photo?.thumbnail) return '';
      if (photo.thumbnail.startsWith('http')) return photo.thumbnail;
      return `${apiBase}/uploads/${photo.thumbnail}`;
    };
    const padId = (id) => id ? String(id).padStart(3, '0') : '???';

    onMounted(async () => {
      try {
        await Promise.all([
          analogStore.fetchGalleryDetail(route.params.galleryId),
          adminStore.fetchTags()
        ]);
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    });

    // --- Inline meta edit ---
    const startEdit = () => {
      metaForm.value = {
        title: gallery.value?.title || '',
        camera: gallery.value?.camera || '',
        film_stock: gallery.value?.film_stock || '',
        month: gallery.value?.month || new Date().getMonth() + 1,
        year: gallery.value?.year || new Date().getFullYear(),
        notes: gallery.value?.notes || '',
        tagsInput: parsedTags.value.map(t => t.name).join(', ')
      };
      editingMeta.value = true;
    };

    const cancelEdit = () => { editingMeta.value = false; };

    const saveMeta = async () => {
      savingMeta.value = true;
      try {
        const tagNames = metaForm.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds = [];
        if (tagNames.length > 0) {
          await adminStore.fetchTags();
          for (const name of tagNames) {
            let existing = adminStore.tags.find(t => t.name.toLowerCase() === name.toLowerCase());
            if (!existing) existing = await adminStore.createTag({ name });
            tagIds.push(existing.id);
          }
        }
        await analogStore.saveGalleryDetail(route.params.galleryId, {
          title: metaForm.value.title,
          camera: metaForm.value.camera,
          film_stock: metaForm.value.film_stock,
          month: metaForm.value.month,
          year: metaForm.value.year,
          notes: metaForm.value.notes,
          tagIds
        });
        editingMeta.value = false;
        ui.success('// ROLL METADATA SAVED //');
      } catch (err) {
        ui.error('Couldn\'t save the roll details. Please try again.');
      } finally {
        savingMeta.value = false;
      }
    };

    // --- Gallery publish toggle ---
    const handleTogglePublish = async () => {
      publishingGallery.value = true;
      try {
        await analogStore.toggleGalleryPublished(route.params.galleryId);
      } catch (err) {
        ui.error('Couldn\'t change the publish state. Please try again.');
      } finally {
        publishingGallery.value = false;
      }
    };

    // --- Photo gallery toggle (+GAL / -GAL) ---
    const handleToggleGallery = async (photo) => {
      try {
        await analogStore.togglePhotoGallery(photo.id, route.params.galleryId);
      } catch (err) {
        ui.error('Couldn\'t update this frame. Please try again.');
      }
    };

    // --- Lightbox ---
    const onPhotoClick = (photo) => {
      if (!photo.in_gallery) return;
      const idx = galleryPhotos.value.findIndex(p => p.id === photo.id);
      if (idx !== -1) {
        lightboxIdx.value = idx;
        lightboxOpen.value = true;
      }
    };

    const navigateLightbox = (dir) => {
      const len = galleryPhotos.value.length;
      lightboxIdx.value = (lightboxIdx.value + dir + len) % len;
    };

    // --- Upload ---
    const handleUpload = async ({ files, onSuccess, onFailure }) => {
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));
        await analogStore.uploadPhotos(route.params.galleryId, formData);
        onSuccess();
        showUpload.value = false;
        const n = files.length;
        ui.success(`// ${n} ${n === 1 ? 'SCAN' : 'SCANS'} ADDED //`);
      } catch (err) {
        onFailure();
        ui.error('Upload failed. Please check your connection and try again.');
      }
    };

    // --- Delete ---
    const handleDelete = async (photo) => {
      const ok = await ui.confirm({
        title: 'SCRAP FRAME',
        message: `Permanently delete frame #${photo.id}? This can't be undone.`,
        confirmLabel: 'SCRAP IT',
        cancelLabel: 'KEEP',
        tone: 'danger'
      });
      if (!ok) return;
      try {
        await analogStore.deletePhoto(photo.id, route.params.galleryId);
        ui.success('// FRAME SCRAPPED //');
      } catch (err) {
        ui.error('Couldn\'t delete the frame. Please try again.');
      }
    };

    // --- Feed unpublish ---
    const handleUnpublish = async (photo) => {
      try {
        await analogStore.unpublishPhoto(photo.id, route.params.galleryId);
        ui.success('// FRAME UNPUBLISHED //');
      } catch (err) {
        ui.error('Couldn\'t unpublish the frame. Please try again.');
      }
    };

    // --- Publish to feed modal ---
    const openPublishModal = (photo) => {
      publishModal.value = { show: true, photo, caption: photo.caption || '', selectedTags: [], submitting: false };
    };

    const addPublishTag = (event) => {
      const tagId = parseInt(event.target.value, 10);
      const tag = allTags.value.find(t => t.id === tagId);
      if (tag) publishModal.value.selectedTags.push(tag);
      event.target.value = '';
    };

    const removePublishTag = (tagId) => {
      publishModal.value.selectedTags = publishModal.value.selectedTags.filter(t => t.id !== tagId);
    };

    const submitPublish = async () => {
      publishModal.value.submitting = true;
      try {
        await analogStore.publishPhoto(
          publishModal.value.photo.id,
          { caption: publishModal.value.caption, tagIds: publishModal.value.selectedTags.map(t => t.id) },
          route.params.galleryId
        );
        publishModal.value.show = false;
        ui.success('// FRAME PUBLISHED TO FEED //');
      } catch (err) {
        ui.error('Couldn\'t publish the frame. Please try again.');
        publishModal.value.submitting = false;
      }
    };

    // --- Drag reorder ---
    const onDragStart = (idx) => { dragSourceIdx.value = idx; };

    const onDragOver = (idx) => {
      if (dragSourceIdx.value !== null && dragSourceIdx.value !== idx) {
        dragOverIdx.value = idx;
      }
    };

    const onDragLeave = () => { dragOverIdx.value = null; };

    const onDrop = (targetIdx) => {
      if (dragSourceIdx.value === null || dragSourceIdx.value === targetIdx) return;
      const moved = editablePhotos.value.splice(dragSourceIdx.value, 1)[0];
      editablePhotos.value.splice(targetIdx, 0, moved);
      editablePhotos.value.forEach((p, i) => { p.sort_order = i; });
      orderChanged.value = true;
      dragSourceIdx.value = null;
      dragOverIdx.value = null;
    };

    const onDragEnd = () => {
      dragSourceIdx.value = null;
      dragOverIdx.value = null;
    };

    // Keyboard / touch reorder: same effect as a drag, one position at a time.
    const movePhoto = (idx, delta) => {
      const target = idx + delta;
      if (target < 0 || target >= editablePhotos.value.length) return;
      const [moved] = editablePhotos.value.splice(idx, 1);
      editablePhotos.value.splice(target, 0, moved);
      editablePhotos.value.forEach((p, i) => { p.sort_order = i; });
      orderChanged.value = true;
    };

    const saveOrder = async () => {
      savingOrder.value = true;
      try {
        const updates = editablePhotos.value.map((p, i) => ({ id: p.id, sort_order: i }));
        await analogStore.reorderPhotos(route.params.galleryId, updates);
        orderChanged.value = false;
        ui.success('// ORDER SAVED //');
      } catch (err) {
        ui.error('Couldn\'t save the new order. Please try again.');
      } finally {
        savingOrder.value = false;
      }
    };

    return {
      gallery,
      editablePhotos,
      galleryPhotos,
      lightboxPhoto,
      lightboxOpen,
      loading,
      error,
      showUpload,
      editingMeta,
      savingMeta,
      metaForm,
      publishingGallery,
      publishModal,
      parsedTags,
      availablePublishTags,
      dragSourceIdx,
      dragOverIdx,
      orderChanged,
      savingOrder,
      thumbUrl,
      padId,
      startEdit,
      cancelEdit,
      saveMeta,
      handleTogglePublish,
      handleToggleGallery,
      onPhotoClick,
      navigateLightbox,
      handleUpload,
      handleDelete,
      handleUnpublish,
      openPublishModal,
      addPublishTag,
      removePublishTag,
      submitPublish,
      onDragStart,
      onDragOver,
      onDragLeave,
      onDrop,
      onDragEnd,
      movePhoto,
      saveOrder
    };
  }
};
</script>

<style scoped>
.frame__actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

/* Pointer + hover devices: reveal actions as an overlay on hover or when a
   control inside receives keyboard focus. */
@media (hover: hover) and (pointer: fine) {
  .frame__actions {
    position: absolute;
    inset: 0;
    justify-content: center;
    padding: var(--space-2);
    background: rgba(10, 10, 15, 0.85);
    opacity: 0;
    transition: opacity var(--dur-fast) var(--ease);
  }

  .frame:hover .frame__actions,
  .frame:focus-within .frame__actions {
    opacity: 1;
  }
}

/* Touch / coarse pointers: no hover exists, so keep actions visible as a bar
   below the frame (an always-on overlay would permanently hide the photo).
   Comfortable tap targets per WCAG 2.5.5. */
@media (hover: none), (pointer: coarse) {
  .frame__actions {
    padding: var(--space-2);
    background: var(--surface);
    border-top: 1px solid var(--grid);
  }

  .frame__actions > button {
    min-height: 40px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .frame__actions {
    transition: none;
  }
}
</style>
