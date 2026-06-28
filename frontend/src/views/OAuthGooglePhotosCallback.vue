<template>
  <div class="flex items-center justify-center h-screen bg-void font-body text-phosphor text-sm">
    Connecting Google Photos<span class="cursor">...</span>
  </div>
</template>

<script>
export default {
  name: 'OAuthGooglePhotosCallback',
  mounted() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (window.opener) {
      window.opener.postMessage(
        { type: 'GOOGLE_PHOTOS_AUTH', code: code || null, error: error || null },
        window.location.origin
      );
      window.close();
    }
  }
};
</script>
