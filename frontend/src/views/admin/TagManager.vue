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
        <thead class="bg-panel/60 border-b border-gridColor font-label text-fog select-none text-xs uppercase">
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
            <td class="p-3 text-center font-label text-fog">
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
            <td class="p-3 select-none font-label">
              <div class="flex flex-wrap items-center justify-end gap-x-1 gap-y-1">
                <button class="inline-flex items-center min-h-[32px] px-2 text-phosphor hover:underline text-xs" @click="openEditModal(t)">
                  [ EDIT ]
                </button>
                <button class="inline-flex items-center min-h-[32px] px-2 text-neon-red hover:underline text-xs" @click="confirmDeleteTag(t)">
                  [ SCRAP ]
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- CREATE / EDIT MODAL -->
    <TerminalModal
      v-model="showModal"
      :title="`// ${isEditMode ? 'EDIT' : 'CREATE'} TAG //`"
      max-width="420px"
    >
      <form @submit.prevent="submitForm" class="space-y-4">
        <div>
          <label for="tag-name" class="text-xs font-label text-fog uppercase block mb-1">Tag Name</label>
          <div class="tinput">
            <span class="tinput__prompt">#</span>
            <input id="tag-name" v-model="form.name" required placeholder="e.g. street" />
          </div>
        </div>

        <div>
          <label for="tag-color" class="text-xs font-label text-fog uppercase block mb-1">Color HEX (Optional)</label>
          <div class="tinput">
            <span class="tinput__prompt">&gt;</span>
            <input id="tag-color" v-model="form.color" placeholder="e.g. #00FF94" />
          </div>
          <div class="text-[11px] text-fog mt-1">Leave empty to use default green CRT glow.</div>
        </div>

        <div class="flex justify-end gap-3 pt-4 select-none">
          <button type="button" class="btn btn--ghost text-xs" @click="showModal = false">[ CANCEL ]</button>
          <button type="submit" class="btn text-xs">[ {{ isEditMode ? 'UPDATE' : 'TRANSMIT' }} ]</button>
        </div>
      </form>
    </TerminalModal>
  </div>
</template>

<script>
import { ref, computed, onMounted } from 'vue';
import { useAdminStore } from '@/stores/admin';
import { useUiStore } from '@/stores/ui';
import TagBadge from '@/components/TagBadge.vue';
import TerminalModal from '@/components/TerminalModal.vue';

export default {
  name: 'AdminTagManager',
  components: {
    TagBadge,
    TerminalModal
  },
  setup() {
    const adminStore = useAdminStore();
    const ui = useUiStore();

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
        ui.success(isEditMode.value ? '// TAG UPDATED //' : '// TAG CREATED //');
      } catch (err) {
        ui.error('Couldn\'t save the tag. The name may already exist.');
      }
    };

    const confirmDeleteTag = async (tag) => {
      const ok = await ui.confirm({
        title: 'DELETE TAG',
        message: `'${tag.name}' is used in ${tag.gallery_count} galleries and ${tag.photo_count} photos. Deleting it unassigns it from all of them.`,
        confirmLabel: 'DELETE TAG',
        cancelLabel: 'CANCEL',
        tone: 'danger'
      });
      if (!ok) return;
      try {
        await adminStore.deleteTag(tag.id);
        ui.success('// TAG DELETED //');
      } catch (err) {
        ui.error('Couldn\'t delete the tag. Please try again.');
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
