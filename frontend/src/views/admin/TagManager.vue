<template>
  <div class="space-y-8 select-text">
    <header class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gridColor pb-6 gap-4">
      <div>
        <h2 class="text-2xl md:text-3xl font-display text-white uppercase tracking-wide">
          TAG TAXONOMY CONTROL
        </h2>
        <p class="text-xs font-body text-fog mt-1">
          Review, edit, and consolidate global classification tags.
        </p>
      </div>

      <!-- Add Tag Action -->
      <div class="select-none self-end sm:self-auto">
        <button class="btn btn--sm" @click="openCreateModal">
          [ + CREATE CLASSIFIER ]
        </button>
      </div>
    </header>

    <!-- Tags Table -->
    <div v-if="loading" class="flex items-center justify-center py-20 font-body text-phosphor">
      SCANNING DATABASE SEGMENTS<span class="cursor">...</span>
    </div>

    <div v-else-if="tags.length === 0" class="text-xs font-body text-fog py-20 border border-dashed border-gridColor text-center select-none">
      // NO CLASSIFIERS REGISTERED IN DATABASE //
    </div>

    <div v-else class="overflow-x-auto border border-gridColor bg-surface">
      <table class="w-full text-left font-body text-xs border-collapse">
        <thead class="bg-panel/60 border-b border-gridColor font-label text-dust select-none text-[10px] uppercase">
          <tr>
            <th class="p-3 w-16 text-center">ID</th>
            <th class="p-3">Tag Label</th>
            <th class="p-3 w-28 text-center">In Galleries</th>
            <th class="p-3 w-28 text-center">In Frames</th>
            <th class="p-3 w-32 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gridColor/50">
          <tr v-for="t in tags" :key="t.id" class="hover:bg-panel/20">
            <!-- ID -->
            <td class="p-3 text-center font-label text-dust">
              #{{ String(t.id).padStart(3, '0') }}
            </td>
            <!-- Tag Label preview -->
            <td class="p-3 select-none">
              <TagBadge :name="t.name" :color="t.color" />
            </td>
            <!-- Gallery counts -->
            <td class="p-3 text-center font-label text-chrome">
              {{ t.gallery_count }}
            </td>
            <!-- Photo counts -->
            <td class="p-3 text-center font-label text-chrome">
              {{ t.photo_count }}
            </td>
            <!-- Actions -->
            <td class="p-3 text-right select-none font-label space-x-3">
              <button class="text-phosphor hover:underline text-[10px]" @click="openEditModal(t)">
                [ EDIT ]
              </button>
              <button class="text-neon-red hover:underline text-[10px]" @click="confirmDeleteTag(t)">
                [ SCRAP ]
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CREATE / EDIT MODAL -->
    <div v-if="showModal" class="fixed inset-0 z-[400] bg-void/90 flex items-center justify-center p-6" @click.self="showModal = false">
      <div class="demo bracket max-w-[420px] w-full bg-surface border border-gridColor p-6">
        <span class="br-tr"></span><span class="br-bl"></span>
        <h3 class="text-white font-display text-2xl uppercase mb-6 text-shadow-phosphor">
          // {{ isEditMode ? 'EDIT' : 'CREATE' }} TAG //
        </h3>
        
        <form @submit.prevent="submitForm" class="space-y-4">
          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Tag Name</label>
            <div class="tinput">
              <span class="tinput__prompt">#</span>
              <input v-model="form.name" required placeholder="e.g. street" />
            </div>
          </div>

          <div>
            <label class="text-[10px] font-label text-dust uppercase block mb-1">Color HEX (Optional)</label>
            <div class="tinput">
              <span class="tinput__prompt">&gt;</span>
              <input v-model="form.color" placeholder="e.g. #00FF94" />
            </div>
            <div class="text-[9px] text-dust mt-1">Leave empty to use default green CRT glow.</div>
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
import { useAdminStore } from '@/stores/admin';
import TagBadge from '@/components/TagBadge.vue';

export default {
  name: 'AdminTagManager',
  components: {
    TagBadge
  },
  setup() {
    const adminStore = useAdminStore();

    const showModal = ref(false);
    const isEditMode = ref(false);
    const editTagId = ref(null);

    const form = ref({
      name: '',
      color: ''
    });

    const tags = computed(() => adminStore.tags);
    const loading = computed(() => adminStore.loading);

    onMounted(() => {
      adminStore.fetchTags();
    });

    const resetForm = () => {
      form.value = {
        name: '',
        color: ''
      };
    };

    const openCreateModal = () => {
      resetForm();
      isEditMode.value = false;
      showModal.value = true;
    };

    const openEditModal = (tag) => {
      editTagId.value = tag.id;
      form.value = {
        name: tag.name,
        color: tag.color || ''
      };
      isEditMode.value = true;
      showModal.value = true;
    };

    const submitForm = async () => {
      try {
        const payload = {
          name: form.value.name.toLowerCase().trim(),
          color: form.value.color.trim() || null
        };

        if (isEditMode.value) {
          await adminStore.updateTag(editTagId.value, payload);
        } else {
          await adminStore.createTag(payload);
        }

        showModal.value = false;
      } catch (err) {
        alert('Taxonomy Database Error: ' + err.message);
      }
    };

    const confirmDeleteTag = async (tag) => {
      const warnMsg = `CRITICAL WARNING: The tag '${tag.name}' is currently used in ${tag.gallery_count} galleries and ${tag.photo_count} photos. Deleting it will unassign it from all items. Proceed?`;
      if (confirm(warnMsg)) {
        await adminStore.deleteTag(tag.id);
      }
    };

    return {
      showModal,
      isEditMode,
      form,
      tags,
      loading,
      openCreateModal,
      openEditModal,
      submitForm,
      confirmDeleteTag
    };
  }
};
</script>
