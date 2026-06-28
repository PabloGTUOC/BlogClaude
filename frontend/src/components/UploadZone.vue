<template>
  <div class="space-y-4">
    <div
      :class="['drop w-full flex flex-col items-center justify-center border transition-all duration-150 min-h-[220px]', 
               isDragOver ? 'dragover border-solid bg-phosphor/5' : 'border-dashed border-phosphor bg-void']"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="onDragLeave"
      @drop.prevent="onDrop"
      @click="triggerFileSelect"
    >
      <input
        type="file"
        ref="fileInput"
        class="hidden"
        multiple
        accept="image/*,video/*"
        @change="onFileSelected"
      />

      <div class="drop__label select-none text-phosphor text-3xl font-display uppercase tracking-wide">
        // {{ label }} //
      </div>

      <div v-if="files.length > 0" class="text-xs font-body text-fog max-w-md select-none mt-2">
        STAGED: {{ files.length }} FILES [ {{ stagedFilesNames }} ]
      </div>
      <div v-else class="text-xs font-body text-dust select-none mt-1">
        DRAG FILES HERE OR CLICK TO BROWSE LOCAL STORAGE
      </div>
    </div>

    <!-- Progress Meter -->
    <div v-if="isTransmitting" class="flex flex-col items-center select-none font-body text-sm space-y-1">
      <div class="text-phosphor tracking-wider">{{ progressBar }}</div>
      <div class="text-xs text-dust">TRANSMITTING DATA TO BEAM TERMINAL...</div>
    </div>

    <!-- Actions Row -->
    <div v-if="files.length > 0 && !isTransmitting" class="flex justify-end gap-3">
      <button class="btn btn--ghost btn--sm" @click="clear">
        [ CLEAR ]
      </button>
      <button class="btn btn--sm" :disabled="isTransmitting" @click="upload">
        [ TRANSMIT ]
      </button>
    </div>
  </div>
</template>

<script>
import { ref, computed } from 'vue';

export default {
  name: 'UploadZone',
  props: {
    label: {
      type: String,
      default: 'DROP SCANS HERE'
    }
  },
  emits: ['files-uploaded'],
  setup(props, { emit }) {
    const fileInput = ref(null);
    const files = ref([]);
    const isDragOver = ref(false);
    const isTransmitting = ref(false);
    const progress = ref(0);

    const stagedFilesNames = computed(() => {
      return files.value.map(f => f.name).slice(0, 3).join(', ') + (files.value.length > 3 ? '...' : '');
    });

    const progressBar = computed(() => {
      const cellsCount = 15;
      const filled = Math.round((progress.value / 100) * cellsCount);
      const empty = cellsCount - filled;
      return `[${'█'.repeat(filled)}${'░'.repeat(empty)}] ${progress.value}%`;
    });

    const triggerFileSelect = () => {
      if (!isTransmitting.value) {
        fileInput.value.click();
      }
    };

    const onDragOver = () => {
      isDragOver.value = true;
    };

    const onDragLeave = () => {
      isDragOver.value = false;
    };

    const onDrop = (e) => {
      isDragOver.value = false;
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
      if (droppedFiles.length > 0) {
        files.value = [...files.value, ...droppedFiles];
      }
    };

    const onFileSelected = (e) => {
      const selectedFiles = Array.from(e.target.files);
      if (selectedFiles.length > 0) {
        files.value = [...files.value, ...selectedFiles];
      }
    };

    const clear = () => {
      files.value = [];
      progress.value = 0;
      isTransmitting.value = false;
      if (fileInput.value) fileInput.value.value = '';
    };

    const upload = async () => {
      if (files.value.length === 0 || isTransmitting.value) return;

      isTransmitting.value = true;
      progress.value = 0;

      // Simulate a gradual progress bar load for retro aesthetic transmission
      const interval = setInterval(() => {
        if (progress.value < 90) {
          progress.value += Math.floor(Math.random() * 15) + 5;
          if (progress.value > 90) progress.value = 90;
        }
      }, 150);

      // Emit files to parent so it performs the actual axios/API call
      try {
        emit('files-uploaded', {
          files: files.value,
          onSuccess: () => {
            clearInterval(interval);
            progress.value = 100;
            setTimeout(() => {
              clear();
            }, 600);
          },
          onFailure: () => {
            clearInterval(interval);
            isTransmitting.value = false;
            progress.value = 0;
          }
        });
      } catch (err) {
        clearInterval(interval);
        isTransmitting.value = false;
        progress.value = 0;
      }
    };

    return {
      fileInput,
      files,
      isDragOver,
      isTransmitting,
      progress,
      stagedFilesNames,
      progressBar,
      triggerFileSelect,
      onDragOver,
      onDragLeave,
      onDrop,
      onFileSelected,
      clear,
      upload
    };
  }
};
</script>
