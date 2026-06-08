<template>
  <div class="wrap py-12">
    <div class="demo bracket max-w-[480px] w-full mx-auto bg-surface border border-gridColor p-8">
      <span class="br-tr"></span><span class="br-bl"></span>
      <h3 class="text-white font-display text-2xl uppercase mb-4 text-shadow-phosphor">// GOOGLE CLOUD OAUTH //</h3>
      <p class="font-body text-xs text-fog leading-relaxed mb-6">
        This route handles synchronization handshakes with Google Photos API integration.
      </p>
      <div class="text-center select-none">
        <router-link to="/digital" class="btn btn--sm">[ RETURN TO TIMELINE ]</router-link>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'GooglePhotosImport'
};
</script>
