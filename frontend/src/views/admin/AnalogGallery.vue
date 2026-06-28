<template>
  <div class="space-y-6 select-text">
    <!-- Header -->
    <header class="border-b border-gridColor pb-6 space-y-4">
      <router-link to="/admin/analog" class="btn btn--ghost btn--sm text-[10px] select-none inline-block">
        [ ◀ ANALOG INDEX ]
      </router-link>

      <!-- VIEW MODE -->
      <div v-if="!editingMeta" class="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div class="space-y-2">
          <div class="flex items-baseline gap-3 flex-wrap">
            <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
              ROLL #{{ padId(gallery?.id) }}: {{ gallery?.title || '...' }}
            </h2>
            <button v-if="gallery" class="btn btn--ghost btn--sm text-[9px] select-none" @click="startEdit">[ EDIT ]</button>
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
        <div class="text-[10px] font-label text-dust uppercase select-none">// EDITING ROLL #{{ padId(gallery?.id) }}</div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Roll Title</label>
            <div class="tinput"><input v-model="metaForm.title" placeholder="e.g. Tokyo Neon" /></div>
          </div>
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Camera Body</label>
            <div class="tinput"><input v-model="metaForm.camera" placeholder="e.g. Canon AE-1" /></div>
          </div>
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Film Stock</label>
            <div class="tinput"><input v-model="metaForm.film_stock" placeholder="e.g. HP5 Plus" /></div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Month</label>
              <div class="tinput"><input v-model.number="metaForm.month" type="number" min="1" max="12" /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Year</label>
              <div class="tinput"><input v-model.number="metaForm.year" type="number" min="1900" max="2100" /></div>
            </div>
          </div>
        </div>
        <div>
          <label class="text-[10px] font-label text-dust uppercase block mb-1">Tags (comma separated)</label>
          <div class="tinput"><input v-model="metaForm.tagsInput" placeholder="street, night" /></div>
        </div>
        <div>
          <label class="text-[10px] font-label text-dust uppercase block mb-1">Notes</label>
          <div class="tinput"><textarea v-model="metaForm.notes" rows="2" placeholder="Optional roll notes..."></textarea></div>
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
      <h4 class="text-xs font-label text-dust uppercase mb-3 select-none">// TRANSMIT SCANS TO THIS ROLL</h4>
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
        <h3 class="font-label text-xs text-dust uppercase">// CONTACT SHEET ({{ editablePhotos.length }} FRAMES)</h3>
        <div class="flex items-center gap-4 text-[9px] font-label text-dust/60">
          <span v-if="galleryPhotos.length > 0" class="text-phosphor/80">{{ galleryPhotos.length }} IN GALLERY</span>
          <span v-if="editablePhotos.length > 1">DRAG TO REORDER</span>
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
            'relative group overflow-hidden',
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
          <div class="absolute top-0 right-0 flex flex-col items-end pointer-events-none">
            <span v-if="photo.in_gallery" class="bg-phosphor text-void font-label text-[7px] leading-none px-[3px] py-[2px]">G</span>
            <span v-if="photo.is_public" class="bg-neon-red text-white font-label text-[7px] leading-none px-[3px] py-[2px]">F</span>
          </div>

          <!-- Hover action overlay -->
          <div class="absolute inset-0 bg-void/85 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-stretch justify-center gap-1 p-2">
            <button
              :class="[
                'font-label text-[10px] leading-none py-1.5 border text-center transition-colors',
                photo.in_gallery
                  ? 'border-dust/50 text-dust hover:border-neon-red hover:text-neon-red'
                  : 'border-phosphor/50 text-phosphor hover:bg-phosphor/20'
              ]"
              @click.stop="handleToggleGallery(photo)"
            >{{ photo.in_gallery ? '— GALLERY' : '+ GALLERY' }}</button>
            <button
              v-if="!photo.is_public"
              class="font-label text-[10px] leading-none py-1.5 border border-amber/60 text-amber hover:bg-amber/10 transition-colors text-center"
              @click.stop="openPublishModal(photo)"
            >+ FEED</button>
            <button
              v-else
              class="font-label text-[10px] leading-none py-1.5 border border-dust/40 text-dust hover:bg-dust/20 transition-colors text-center"
              @click.stop="handleUnpublish(photo)"
            >— FEED</button>
            <button
              class="font-label text-[10px] leading-none py-1.5 border border-neon-red/50 text-neon-red hover:bg-neon-red/20 transition-colors text-center"
              @click.stop="handleDelete(photo)"
            >DELETE</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Publish to Feed Modal -->
    <div v-if="publishModal.show" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="publishModal.show = false">
      <div class="demo bracket max-w-[500px] w-full bg-surface border border-gridColor p-6">
        <span class="br-tr"></span><span class="br-bl"></span>

        <h3 class="text-white font-display text-2xl uppercase mb-1 text-shadow-phosphor">// PUBLISH TO FEED //</h3>
        <p class="text-[10px] font-body text-dust mb-6">Frame will be added to the public photo feed.</p>

        <img v-if="publishModal.photo" :src="thumbUrl(publishModal.photo)" class="w-full max-h-48 object-contain border border-gridColor mb-5" />

        <div class="space-y-4">
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Caption</label>
            <div class="tinput"><input v-model="publishModal.caption" placeholder="Optional caption..." /></div>
          </div>
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Tags</label>
            <div class="flex flex-wrap gap-2 mb-2">
              <span
                v-for="tag in publishModal.selectedTags"
                :key="tag.id"
                class="tag text-[10px] flex items-center gap-1"
              >
                {{ tag.name }}
                <button class="text-neon-red hover:underline leading-none" @click="removePublishTag(tag.id)">×</button>
              </span>
            </div>
            <div class="tinput">
              <span class="tinput__prompt">+</span>
              <select class="flex-1 bg-transparent border-none outline-none text-chrome font-body text-sm" @change="addPublishTag($event)">
                <option value="" disabled selected>add tag...</option>
                <option v-for="t in availablePublishTags" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 mt-6 select-none">
          <button class="btn btn--ghost text-xs" @click="publishModal.show = false">[ CANCEL ]</button>
          <button class="btn text-xs" :disabled="publishModal.submitting" @click="submitPublish">
            <span v-if="publishModal.submitting">TRANSMITTING<span class="cursor">_</span></span>
            <span v-else>[ PUBLISH ]</span>
          </button>
        </div>
      </div>
    </div>

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
import GalleryMeta from '@/components/GalleryMeta.vue';
import UploadZone from '@/components/UploadZone.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'AdminAnalogGallery',
  components: {
    GalleryMeta,
    UploadZone,
    Lightbox
  },
  setup() {
    const route = useRoute();
    const analogStore = useAnalogStore();
    const adminStore = useAdminStore();

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
      } catch (err) {
        alert('Save failed: ' + err.message);
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
        alert('Publish toggle failed: ' + err.message);
      } finally {
        publishingGallery.value = false;
      }
    };

    // --- Photo gallery toggle (+GAL / -GAL) ---
    const handleToggleGallery = async (photo) => {
      try {
        await analogStore.togglePhotoGallery(photo.id, route.params.galleryId);
      } catch (err) {
        alert('Gallery toggle failed: ' + err.message);
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
      } catch (err) {
        onFailure();
      }
    };

    // --- Delete ---
    const handleDelete = async (photo) => {
      if (!confirm(`CRITICAL WARN: PERMANENTLY SCRAP FRAME #${photo.id}? THIS CANNOT BE UNDONE.`)) return;
      try {
        await analogStore.deletePhoto(photo.id, route.params.galleryId);
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    };

    // --- Feed unpublish ---
    const handleUnpublish = async (photo) => {
      try {
        await analogStore.unpublishPhoto(photo.id, route.params.galleryId);
      } catch (err) {
        alert('Unpublish failed: ' + err.message);
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
      } catch (err) {
        alert('Publish failed: ' + err.message);
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

    const saveOrder = async () => {
      savingOrder.value = true;
      try {
        const updates = editablePhotos.value.map((p, i) => ({ id: p.id, sort_order: i }));
        await analogStore.reorderPhotos(route.params.galleryId, updates);
        orderChanged.value = false;
      } catch (err) {
        alert('Reorder failed: ' + err.message);
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
      saveOrder
    };
  }
};
</script>
