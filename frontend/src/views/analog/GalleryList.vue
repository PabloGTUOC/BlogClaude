<template>
  <div class="min-h-[calc(100vh-var(--nav-h)-var(--status-h))] flex flex-col lg:flex-row relative">
    <!-- SIDEBAR (Left on desktop, Top horizontal scroller on mobile) -->
    <aside class="w-full lg:w-[280px] bg-surface border-b lg:border-b-0 lg:border-r border-gridColor select-none flex-shrink-0">
      <!-- Admin Create Roll Trigger -->
      <div v-if="isAdmin" class="p-4 border-b border-gridColor">
        <button class="btn w-full text-xs" @click="showCreateModal = true">
          [ + NEW FILM ROLL ]
        </button>
      </div>

      <!-- Rolls index list -->
      <div class="flex lg:flex-col overflow-x-auto lg:overflow-x-visible lg:overflow-y-auto max-h-[140px] lg:max-h-[calc(100vh-140px)] p-2 lg:p-0 gap-2 lg:gap-0 scrollbar-thin">
        <div
          v-for="roll in galleries"
          :key="roll.id"
          :class="['flex-shrink-0 lg:flex-shrink-1 p-3 lg:px-5 lg:py-4 border-l-2 font-label text-xs uppercase cursor-pointer transition-all duration-150',
                   activeRollId === roll.id ? 'border-phosphor bg-panel text-white text-shadow-phosphor' : 'border-transparent text-dust hover:text-chrome']"
          @click="selectRoll(roll.id)"
        >
          <div class="font-bold">ROLL #{{ String(roll.id).padStart(3, '0') }}</div>
          <div class="text-[10px] text-fog mt-1 truncate max-w-[150px]">{{ roll.film_stock }}</div>
        </div>
      </div>
    </aside>

    <!-- MAIN DASHBOARD CONTENT -->
    <section class="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
      <div v-if="loading && !activeRoll" class="flex items-center justify-center py-20 font-body text-phosphor">
        READING ARCHIVE INDEXES<span class="cursor">...</span>
      </div>

      <div v-else-if="!activeRoll" class="flex flex-col items-center justify-center py-20 font-label text-fog select-none">
        <div>// NO FILM ROLLS LOGGED IN DATABASE //</div>
        <button v-if="isAdmin" class="btn mt-4 text-xs" @click="showCreateModal = true">
          [ ARCHIVE FIRST ROLL ]
        </button>
      </div>

      <div v-else class="space-y-8">
        <!-- Roll Title, Metadata & Actions Header -->
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-4 border-b border-gridColor pb-6">
          <div class="space-y-3">
            <h2 class="text-3xl md:text-4xl font-display text-white tracking-wide uppercase">
              ROLL #{{ String(activeRoll.id).padStart(3, '0') }}: {{ activeRoll.title }}
            </h2>

            <!-- Format EXIF Readout line -->
            <GalleryMeta
              :camera="activeRoll.camera"
              :film-stock="activeRoll.film_stock"
              :month="activeRoll.month"
              :year="activeRoll.year"
              :tags="activeRoll.tags"
            />

            <p v-if="activeRoll.notes" class="text-xs font-body text-fog max-w-3xl leading-relaxed bg-panel/30 p-3 border border-gridColor/40">
              {{ activeRoll.notes }}
            </p>
          </div>

          <!-- Admin controls -->
          <div v-if="isAdmin" class="flex gap-2 select-none self-end md:self-start">
            <button class="btn btn-ghost btn--sm text-[10px]" @click="openEditModal">
              [ EDIT METADATA ]
            </button>
            <button class="btn btn--danger btn--sm text-[10px]" @click="confirmDeleteRoll">
              [ SCRAP ROLL ]
            </button>
          </div>
        </div>

        <!-- Uploader Zone (Admin only) -->
        <div v-if="isAdmin" class="p-4 border border-gridColor bg-surface/50">
          <h4 class="text-xs font-label text-dust uppercase mb-2 select-none">// TRANSMIT IMAGES TO THIS ROLL</h4>
          <UploadZone @files-uploaded="handleFilesUploaded" />
        </div>

        <!-- Photos Grid -->
        <div>
          <h3 class="text-xs font-label text-dust uppercase mb-4 select-none">// CAPTURED FRAMES</h3>
          <div v-if="photos.length === 0" class="text-xs font-body text-fog select-none py-12 border border-dashed border-gridColor/60 text-center">
            // NO FRAMES CAPTURED ON THIS ROLL //
          </div>
          <PhotoGrid v-else :photos="photos" @photo-click="openPhotoLightbox" />
        </div>
      </div>
    </section>

    <!-- CREATE ROLL MODAL -->
    <div v-if="showCreateModal" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showCreateModal = false">
      <div class="demo bracket max-w-[500px] w-full bg-surface border border-gridColor p-6">
        <span class="br-tr"></span><span class="br-bl"></span>
        <h3 class="text-white font-display text-2xl uppercase mb-6 text-shadow-phosphor">// CREATE ANALOG ROLL //</h3>
        
        <form @submit.prevent="submitCreateRoll" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Roll Title</label>
              <div class="tinput"><input v-model="form.title" required placeholder="e.g. Kyoto Walks" /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Camera Body</label>
              <div class="tinput"><input v-model="form.camera" required placeholder="e.g. Leica M6" /></div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="col-span-2">
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Film Stock</label>
              <div class="tinput"><input v-model="form.film_stock" required placeholder="e.g. Portra 400" /></div>
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
              <div class="tinput"><input v-model="form.tagsInput" placeholder="night, street" /></div>
            </div>
          </div>

          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Notes</label>
            <div class="tinput"><textarea v-model="form.notes" placeholder="Optional roll notes..."></textarea></div>
          </div>

          <div class="flex justify-end gap-3 pt-4 select-none">
            <button type="button" class="btn btn--ghost text-xs" @click="showCreateModal = false">[ CANCEL ]</button>
            <button type="submit" class="btn text-xs">[ TRANSMIT ]</button>
          </div>
        </form>
      </div>
    </div>

    <!-- EDIT ROLL MODAL -->
    <div v-if="showEditModal" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showEditModal = false">
      <div class="demo bracket max-w-[500px] w-full bg-surface border border-gridColor p-6">
        <span class="br-tr"></span><span class="br-bl"></span>
        <h3 class="text-white font-display text-2xl uppercase mb-6 text-shadow-phosphor">// EDIT ANALOG ROLL //</h3>
        
        <form @submit.prevent="submitEditRoll" class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Roll Title</label>
              <div class="tinput"><input v-model="form.title" required /></div>
            </div>
            <div>
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Camera Body</label>
              <div class="tinput"><input v-model="form.camera" required /></div>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="col-span-2">
              <label class="text-[10px] font-label text-dust uppercase block mb-1">Film Stock</label>
              <div class="tinput"><input v-model="form.film_stock" required /></div>
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
              <div class="tinput"><input v-model="form.tagsInput" /></div>
            </div>
          </div>

          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Notes</label>
            <div class="tinput"><textarea v-model="form.notes"></textarea></div>
          </div>

          <div class="flex justify-end gap-3 pt-4 select-none">
            <button type="button" class="btn btn--ghost text-xs" @click="showEditModal = false">[ CANCEL ]</button>
            <button type="submit" class="btn text-xs">[ UPDATE ]</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Lightbox for roll photos viewing -->
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
import { ref, computed, onMounted, watch } from 'vue';
import { useAnalogStore } from '@/stores/analog';
import { useAuthStore } from '@/stores/auth';
import { useAdminStore } from '@/stores/admin';
import GalleryMeta from '@/components/GalleryMeta.vue';
import PhotoGrid from '@/components/PhotoGrid.vue';
import UploadZone from '@/components/UploadZone.vue';
import Lightbox from '@/components/Lightbox.vue';

export default {
  name: 'AnalogDashboard',
  components: {
    GalleryMeta,
    PhotoGrid,
    UploadZone,
    Lightbox
  },
  setup() {
    const analogStore = useAnalogStore();
    const authStore = useAuthStore();
    const adminStore = useAdminStore();

    const activeRollId = ref(null);
    const showCreateModal = ref(false);
    const showEditModal = ref(false);
    const selectedPhoto = ref(null);
    const lightboxOpen = ref(false);

    const form = ref({
      title: '',
      camera: '',
      film_stock: '',
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear(),
      notes: '',
      tagsInput: ''
    });

    const isAdmin = computed(() => authStore.isAdmin);
    const loading = computed(() => analogStore.loading);
    const galleries = computed(() => analogStore.galleries);
    const activeRoll = computed(() => analogStore.currentGallery);
    const photos = computed(() => analogStore.currentPhotos);

    onMounted(async () => {
      await analogStore.fetchGalleries();
      if (galleries.value.length > 0) {
        selectRoll(galleries.value[0].id);
      }
    });

    const selectRoll = async (id) => {
      activeRollId.value = id;
      await analogStore.fetchGalleryDetail(id);
    };

    const handleFilesUploaded = async ({ files, onSuccess, onFailure }) => {
      try {
        const formData = new FormData();
        files.forEach(f => formData.append('photos', f));
        await analogStore.uploadPhotos(activeRollId.value, formData);
        onSuccess();
      } catch (err) {
        onFailure();
      }
    };

    const confirmDeleteRoll = async () => {
      if (confirm('CRITICAL WARN: THIS WILL HARD SCRAP THIS FILM ROLL AND ALL ATTACHED SCANS. CONTINUE?')) {
        await analogStore.deleteGallery(activeRollId.value);
        if (galleries.value.length > 0) {
          selectRoll(galleries.value[0].id);
        } else {
          activeRollId.value = null;
          analogStore.currentGallery = null;
          analogStore.currentPhotos = [];
        }
      }
    };

    const submitCreateRoll = async () => {
      try {
        // Tag management
        const tagNames = form.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds = [];

        // Check/Create tags inside admin taxonomy pool
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

        const newRoll = await analogStore.createGallery({
          title: form.value.title,
          camera: form.value.camera,
          film_stock: form.value.film_stock,
          month: form.value.month,
          year: form.value.year,
          notes: form.value.notes,
          tagIds
        });

        showCreateModal.value = false;
        resetForm();
        if (newRoll && newRoll.id) {
          selectRoll(newRoll.id);
        }
      } catch (err) {
        alert('Transmission Failure: ' + err.message);
      }
    };

    const openEditModal = () => {
      if (!activeRoll.value) return;
      form.value = {
        title: activeRoll.value.title,
        camera: activeRoll.value.camera,
        film_stock: activeRoll.value.film_stock,
        month: activeRoll.value.month,
        year: activeRoll.value.year,
        notes: activeRoll.value.notes || '',
        tagsInput: activeRoll.value.tags ? activeRoll.value.tags.map(t => t.name).join(', ') : ''
      };
      showEditModal.value = true;
    };

    const submitEditRoll = async () => {
      try {
        const tagNames = form.value.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        const tagIds = [];

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

        await analogStore.updateGallery(activeRollId.value, {
          title: form.value.title,
          camera: form.value.camera,
          film_stock: form.value.film_stock,
          month: form.value.month,
          year: form.value.year,
          notes: form.value.notes,
          tagIds
        });

        showEditModal.value = false;
        await selectRoll(activeRollId.value);
      } catch (err) {
        alert('Update Failure: ' + err.message);
      }
    };

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
      activeRollId,
      showCreateModal,
      showEditModal,
      selectedPhoto,
      lightboxOpen,
      form,
      isAdmin,
      loading,
      galleries,
      activeRoll,
      photos,
      selectRoll,
      handleFilesUploaded,
      confirmDeleteRoll,
      submitCreateRoll,
      openEditModal,
      submitEditRoll,
      openPhotoLightbox,
      closePhotoLightbox,
      navigateLightbox
    };
  }
};
</script>
