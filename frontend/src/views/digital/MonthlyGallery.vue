<template>
  <div class="wrap py-12">
    <!-- Back btn -->
    <div class="mb-6 select-none font-label text-xs">
      <router-link to="/digital" class="btn btn--ghost btn--sm">
        [ ◀ BACK TO TIMELINE ]
      </router-link>
    </div>

    <div v-if="loading && !gallery" class="flex items-center justify-center py-20 font-body text-phosphor">
      READING ARCHIVE INDEXES<span class="cursor">...</span>
    </div>

    <div v-else-if="error" class="flex flex-col items-center justify-center py-20 font-label text-neon-red">
      <div>// TRANSMISSION CORRUPTED OR GALLERY NOT FOUND //</div>
      <p class="text-xs text-dust mt-2">{{ error }}</p>
    </div>

    <div v-else-if="gallery" class="space-y-8">
      <!-- Month Header -->
      <header class="flex flex-col md:flex-row md:items-baseline md:justify-between border-b border-gridColor pb-6 gap-4">
        <div>
          <div class="month text-white font-display text-4xl uppercase select-none">
            <span class="tri text-amber">▶</span> {{ gallery.display_name }} 
            <span class="text-dust font-label text-base font-normal mx-2">//</span> 
            <span class="frames text-amber text-2xl font-label">{{ photos.length }} FRAMES</span>
          </div>
          <p class="text-xs font-body text-fog mt-1">
            Aggregated timeline directory: {{ gallery.year_month }}.
          </p>
        </div>

        <!-- Ingestion actions -->
        <div class="flex gap-3 select-none self-end md:self-auto">
          <button class="btn btn--ghost btn--sm" @click="triggerGooglePhotosPicker">
            [ LINK GOOGLE PHOTOS ]
          </button>
          <button class="btn btn--sm" @click="showUploadZone = !showUploadZone">
            [ {{ showUploadZone ? 'CLOSE UPLOADER' : 'DIRECT UPLOAD' }} ]
          </button>
        </div>
      </header>

      <!-- Direct Upload Drawer -->
      <div v-if="showUploadZone" class="p-6 border border-gridColor bg-surface/50">
        <h4 class="text-xs font-label text-dust uppercase mb-3 select-none">// TRANSMIT IMAGES TO {{ gallery.display_name }}</h4>
        <UploadZone @files-uploaded="handleFilesUploaded" />
      </div>

      <!-- Photos Grid -->
      <div>
        <!-- Empty state: first-use onboarding — explains the month + offers both upload paths inline.
             Hidden while the upload drawer is open so it doesn't sit under an active uploader. -->
        <div
          v-if="photos.length === 0 && !showUploadZone"
          class="demo bracket flex flex-col items-center text-center gap-6 py-16 px-6 border border-gridColor/60 bg-surface/30 select-none"
        >
          <span class="br-tr"></span><span class="br-bl"></span>

          <div class="font-display text-7xl leading-none text-amber/60" aria-hidden="true">▦</div>

          <div class="space-y-2 max-w-md">
            <h3 class="font-display text-white text-3xl uppercase">
              // EMPTY TIMELINE<span class="cursor">_</span>
            </h3>
            <p class="font-body text-xs text-fog leading-relaxed">
              This is <span class="text-chrome">{{ gallery.display_name }}</span>'s shared gallery.
              The photos and videos you and the family add will show up here.
            </p>
          </div>

          <div class="flex flex-wrap gap-3 justify-center">
            <button class="btn btn--sm" @click="showUploadZone = true">[ DIRECT UPLOAD ]</button>
            <button class="btn btn--ghost btn--sm" @click="triggerGooglePhotosPicker">[ LINK GOOGLE PHOTOS ]</button>
          </div>

          <p class="font-label text-xs text-dust uppercase tracking-wider">
            Add your first frames to start the month
          </p>
        </div>

        <div v-else-if="photos.length > 0" class="grid-photos">
          <!-- Renders cards, with admin delete override overlays -->
          <div v-for="photo in photos" :key="photo.id" class="relative group">
            <PhotoCard :photo="photo" @click="openPhotoLightbox(photo)" />
            
            <!-- Delete overlay: admins can scrap anything, users can scrap their own uploads.
                 card-action keeps it hover-revealed on pointers but always tappable on touch. -->
            <button
              v-if="isAdmin || photo.uploaded_by === currentUserId"
              class="absolute top-2 left-2 z-20 btn btn--danger btn--sm select-none card-action"
              aria-label="Delete this frame"
              @click.stop="confirmDeletePhoto(photo.id)"
            >
              [ SCRAP ]
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- GOOGLE PHOTOS IMPORT PICKER MODAL -->
    <div
      v-if="showGooglePicker"
      class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6"
      @click.self="closeGooglePicker"
    >
      <div
        class="demo bracket max-w-[640px] w-full bg-surface border border-gridColor p-6 flex flex-col h-[80vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Google Photos picker"
      >
        <span class="br-tr"></span><span class="br-bl"></span>

        <header class="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 class="text-white font-display text-2xl uppercase mb-1 text-shadow-phosphor">// GOOGLE PHOTOS PICKER //</h3>
            <p class="text-xs font-body text-dust">Confirm the frames to archive into {{ gallery.display_name }}</p>
          </div>
          <button class="btn btn--ghost btn--sm shrink-0" aria-label="Close picker (Esc)" @click="closeGooglePicker">[ ESC ]</button>
        </header>

        <!-- Media list -->
        <div class="flex-1 overflow-y-auto border border-gridColor p-2 bg-void">
          <div v-if="googleLoading && googlePickerStatus === 'pending'" class="flex items-center justify-center h-full font-body text-phosphor">
            AUTHORIZING WITH GOOGLE<span class="cursor">...</span>
          </div>
          <div v-else-if="googleLoading && googlePickerStatus === 'picking'" class="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p class="font-body text-phosphor">SELECT PHOTOS IN THE GOOGLE POPUP<span class="cursor">...</span></p>
            <p class="font-label text-dust text-xs">Click "Done" in the Google Photos window when finished</p>
          </div>
          <div v-else-if="googleMediaItems.length === 0" class="flex items-center justify-center h-full font-label text-fog">
            // NO PHOTOS SELECTED //
          </div>
          <div v-else class="grid grid-cols-3 sm:grid-cols-4 gap-3">
            <button
              v-for="item in googleMediaItems"
              :key="item.id"
              type="button"
              class="gp-cell"
              :class="{ 'is-selected': selectedGoogleIds.includes(item.id) }"
              :aria-pressed="selectedGoogleIds.includes(item.id)"
              :aria-label="(selectedGoogleIds.includes(item.id) ? 'Selected: ' : 'Select: ') + item.filename"
              @click="toggleGoogleSelect(item)"
            >
              <img :src="item.thumbnailDataUrl || item.baseUrl" class="w-full h-full object-cover" alt="" />
              <!-- Selected wash -->
              <span v-if="selectedGoogleIds.includes(item.id)" class="absolute inset-0 bg-phosphor/15 pointer-events-none"></span>
              <!-- Video indicator -->
              <span v-if="item.type === 'VIDEO'" class="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span class="text-white text-2xl drop-shadow-[0_0_3px_#000]">▶</span>
              </span>
              <!-- Selection check -->
              <span
                v-if="selectedGoogleIds.includes(item.id)"
                class="absolute top-1 right-1 w-5 h-5 flex items-center justify-center bg-phosphor text-void font-label text-xs font-bold leading-none"
              >✓</span>
            </button>
          </div>
        </div>

        <!-- Modal Actions -->
        <div class="flex justify-between items-center mt-4 border-t border-gridColor/50 pt-4 select-none gap-3">
          <span class="text-xs font-body text-fog">
            {{ selectedGooglePhotos.length }} {{ selectedGooglePhotos.length === 1 ? 'FRAME' : 'FRAMES' }} SELECTED
          </span>
          <div class="flex gap-2">
            <button class="btn btn--ghost btn--sm" @click="closeGooglePicker">[ CLOSE ]</button>
            <button class="btn btn--sm" :disabled="selectedGooglePhotos.length === 0 || importingGoogle" @click="submitGoogleImport">
              <span v-if="importingGoogle">IMPORTING<span class="cursor">...</span></span>
              <span v-else>[ IMPORT SELECTED ]</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Lightbox -->
    <Lightbox 
      :photo="selectedPhoto" 
      :is-open="lightboxOpen"
      :show-nav="photos.length > 1"
      @close="closePhotoLightbox"
      @prev="navigateLightbox(-1)"
      @next="navigateLightbox(1)"
    />
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useDigitalStore } from '@/stores/digital';
import { useAuthStore } from '@/stores/auth';
import { useUiStore } from '@/stores/ui';
import GalleryMeta from '@/components/GalleryMeta.vue';
import PhotoCard from '@/components/PhotoCard.vue';
import PhotoGrid from '@/components/PhotoGrid.vue';
import UploadZone from '@/components/UploadZone.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'DigitalMonthlyGallery',
  components: {
    GalleryMeta,
    PhotoCard,
    PhotoGrid,
    UploadZone,
    Lightbox
  },
  setup() {
    const route = useRoute();
    const digitalStore = useDigitalStore();
    const authStore = useAuthStore();
    const ui = useUiStore();

    // Maps backend/OAuth error codes to plain, reassuring copy for non-technical family users.
    const friendlyGoogleError = (raw) => {
      const code = String(raw || '').toLowerCase();
      if (code.includes('cancel') || code === 'access_denied' || code === 'no_code') {
        return 'Google sign-in was cancelled. Nothing was imported.';
      }
      if (code.includes('session') || code.includes('expired')) {
        return 'Your Google Photos session expired. Please pick your photos again.';
      }
      if (code.includes('picker')) {
        return 'Google Photos couldn\'t open the picker. Please try again.';
      }
      return 'Couldn\'t reach Google Photos. Please try again.';
    };

    const error = ref(null);
    const loading = ref(true);
    const showUploadZone = ref(false);
    
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    // Google Photos Picker state
    const showGooglePicker = ref(false);
    const googleLoading = ref(false);
    const googlePickerStatus = ref('pending'); // 'pending' | 'picking' | 'done'
    const googleImportSessionId = ref(null);
    const importingGoogle = ref(false);
    const googleMediaItems = ref([]);
    const selectedGooglePhotos = ref([]);

    const gallery = computed(() => digitalStore.currentGallery);
    const photos = computed(() => digitalStore.currentPhotos);
    const isAdmin = computed(() => authStore.isAdmin);
    const currentUserId = computed(() => authStore.userId);

    const selectedGoogleIds = computed(() => selectedGooglePhotos.value.map(p => p.id));

    // Picker polling timers live at component scope so closeGooglePicker() and unmount
    // can stop them — otherwise the 2s poll keeps running after the modal closes.
    let pollTimer = null;
    let timeoutTimer = null;
    const stopGooglePolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      if (timeoutTimer) clearTimeout(timeoutTimer);
      pollTimer = null;
      timeoutTimer = null;
    };

    const closeGooglePicker = () => {
      stopGooglePolling();
      showGooglePicker.value = false;
      googleLoading.value = false;
    };

    const onPickerKeydown = (e) => {
      if (e.key === 'Escape' && showGooglePicker.value) {
        e.preventDefault();
        closeGooglePicker();
      }
    };

    onMounted(async () => {
      window.addEventListener('keydown', onPickerKeydown);
      await loadGallery();
    });

    onUnmounted(() => {
      window.removeEventListener('keydown', onPickerKeydown);
      stopGooglePolling();
    });

    const loadGallery = async () => {
      try {
        await digitalStore.fetchGalleryDetail(route.params.yearMonth);
      } catch (err) {
        error.value = err.response?.data?.error || err.message;
      } finally {
        loading.value = false;
      }
    };

    const handleFilesUploaded = async ({ files, onSuccess, onFailure }) => {
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));
        await digitalStore.uploadPhotos(gallery.value.id, formData);
        onSuccess();
        showUploadZone.value = false;
        const n = files.length;
        ui.success(`// ${n} ${n === 1 ? 'FRAME' : 'FRAMES'} ARCHIVED //`);
      } catch (err) {
        onFailure();
        ui.error('Upload failed. Please check your connection and try again.');
      }
    };

    const confirmDeletePhoto = async (photoId) => {
      const ok = await ui.confirm({
        title: 'SCRAP FRAME',
        message: 'Remove this frame from the timeline? This can\'t be undone.',
        confirmLabel: 'SCRAP IT',
        cancelLabel: 'KEEP',
        tone: 'danger'
      });
      if (!ok) return;
      try {
        await digitalStore.deletePhoto(photoId, gallery.value.year_month);
        ui.success('// FRAME SCRAPPED //');
      } catch (err) {
        ui.error('Couldn\'t delete that frame. Please try again.');
      }
    };

    // Google Photos Picker — backend-managed OAuth popup with server-side polling.
    // Flow: OAuth popup → backend creates Picker session → popup redirects to Google's picker UI
    // → user picks photos → frontend polls until mediaItemsSet → show items for import.
    const triggerGooglePhotosPicker = async () => {
      googleLoading.value = true;
      googlePickerStatus.value = 'pending';
      googleImportSessionId.value = null;
      showGooglePicker.value = true;
      selectedGooglePhotos.value = [];
      googleMediaItems.value = [];

      // Start clean in case a previous run left timers active
      stopGooglePolling();

      try {
        const { url, sessionId } = await digitalStore.getGooglePhotosOAuthUrl();
        window.open(url, 'google-photos-auth', 'width=600,height=720,left=300,top=80');

        pollTimer = setInterval(async () => {
          try {
            const result = await digitalStore.pollGooglePhotosSession(sessionId);
            if (result.status === 'done') {
              stopGooglePolling();
              googlePickerStatus.value = 'done';
              googleMediaItems.value = result.items || [];
              googleImportSessionId.value = result.importSessionId;
              googleLoading.value = false;
            } else if (result.status === 'error') {
              stopGooglePolling();
              googleLoading.value = false;
              showGooglePicker.value = false;
              ui.error(friendlyGoogleError(result.error), {
                action: { label: 'RETRY', handler: triggerGooglePhotosPicker }
              });
            } else if (result.status === 'picking') {
              googlePickerStatus.value = 'picking';
            }
            // status === 'pending' → keep polling
          } catch (err) {
            // 404 means session expired (user closed popup without completing)
            if (err.response?.status === 404) {
              closeGooglePicker();
            }
          }
        }, 2000);

        // Hard timeout after 10 minutes (picker UI may take a while)
        timeoutTimer = setTimeout(() => {
          if (googleLoading.value) closeGooglePicker();
          else stopGooglePolling();
        }, 10 * 60 * 1000);
      } catch (err) {
        closeGooglePicker();
        ui.error(friendlyGoogleError(err.response?.data?.error || err.message), {
          action: { label: 'RETRY', handler: triggerGooglePhotosPicker }
        });
      }
    };


    const toggleGoogleSelect = (item) => {
      const idx = selectedGooglePhotos.value.findIndex(p => p.id === item.id);
      if (idx === -1) {
        selectedGooglePhotos.value.push(item);
      } else {
        selectedGooglePhotos.value.splice(idx, 1);
      }
    };

    const submitGoogleImport = async () => {
      importingGoogle.value = true;
      try {
        // Build items payload (backend will download the images using baseUrls)
        const payload = selectedGooglePhotos.value.map(item => ({
          id: item.id,
          type: item.type || 'PHOTO',
          baseUrl: item.baseUrl,
          filename: item.filename || 'google_photos_import.jpg',
          creationTime: item.creationTime || null
        }));

        await digitalStore.importGooglePhotos(gallery.value.id, payload, googleImportSessionId.value);
        closeGooglePicker();
        const n = payload.length;
        ui.success(`// ${n} ${n === 1 ? 'FRAME' : 'FRAMES'} ARCHIVED FROM GOOGLE PHOTOS //`);
      } catch (err) {
        const code = err.response?.data?.code || err.response?.data?.error || err.message;
        // Session-expired can't be retried in place (user must re-pick); other failures can.
        const expired = String(code).toLowerCase().includes('session') || String(code).toLowerCase().includes('expired');
        ui.error(friendlyGoogleError(code), expired ? {} : {
          action: { label: 'RETRY', handler: submitGoogleImport }
        });
      } finally {
        importingGoogle.value = false;
      }
    };

    const openPhotoLightbox = (photo) => {
      selectedPhoto.value = photo;
      lightboxOpen.value = true;
    };

    const closePhotoLightbox = () => {
      lightboxOpen.value = false;
    };

    const navigateLightbox = (direction) => {
      if (!selectedPhoto.value) return;
      const currentIndex = photos.value.findIndex(p => p.id === selectedPhoto.value.id);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = photos.value.length - 1;
      if (nextIndex >= photos.value.length) nextIndex = 0;

      selectedPhoto.value = photos.value[nextIndex];
    };

    return {
      gallery,
      photos,
      loading,
      error,
      showUploadZone,
      isAdmin,
      currentUserId,
      selectedPhoto,
      lightboxOpen,
      showGooglePicker,
      googleLoading,
      googlePickerStatus,
      googleImportSessionId,
      importingGoogle,
      googleMediaItems,
      selectedGooglePhotos,
      selectedGoogleIds,
      handleFilesUploaded,
      confirmDeletePhoto,
      triggerGooglePhotosPicker,
      closeGooglePicker,
      toggleGoogleSelect,
      submitGoogleImport,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>
