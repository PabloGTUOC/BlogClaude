<template>
  <div class="wrap py-12 select-text">
    <header class="section__head mb-8">
      <div class="section__num">00</div>
      <h2 class="section__title">// SYSTEM SPECS //</h2>
    </header>

    <div class="max-w-3xl space-y-6 font-body text-chrome text-sm md:text-base leading-relaxed">
      <div class="demo bracket p-6">
        <span class="br-tr"></span><span class="br-bl"></span>
        <h3 class="text-white font-label text-base md:text-lg mb-4 uppercase tracking-wide">
          // ARCHIVAL STATEMENT //
        </h3>
        <p>
          Enderthoughts is a photo blog built on retro-brutalist industrial principles. It runs as a containerized stack hosted on a local Ubuntu server nodes in a home NAS loop, transmitting scans and frames to the public domain.
        </p>
        <p class="mt-4">
          This system splits galleries into two distinct archival directories:
        </p>
        <ul class="list-disc list-inside mt-2 space-y-2 text-fog">
          <li>
            <strong class="text-phosphor uppercase">Analog Zone:</strong> A chemical index mapping physically processed film rolls, cameras, film stocks, exposure details, and lens specifications.
          </li>
          <li>
            <strong class="text-amber uppercase">Digital Zone:</strong> A collaborative monthly timeline letting approved family members contribute and aggregate photos into unified calendar folders.
          </li>
        </ul>
      </div>

      <div class="p-6 border border-gridColor bg-surface">
        <h3 class="text-white font-label text-base uppercase tracking-wide mb-3">
          // HARDWARE SPECIFICATIONS //
        </h3>
        <table class="w-full text-xs font-body text-fog border-collapse">
          <tbody>
            <tr class="border-b border-gridColor/50">
              <td class="py-2 pr-4 font-bold text-phosphor">HOST NODES:</td>
              <td class="py-2 text-chrome">MacBook Pro (2015, Core i7, 16GB RAM)</td>
            </tr>
            <tr class="border-b border-gridColor/50">
              <td class="py-2 pr-4 font-bold text-phosphor">OPERATING SYS:</td>
              <td class="py-2 text-chrome">Ubuntu Server 24.04 LTS (x86_64)</td>
            </tr>
            <tr class="border-b border-gridColor/50">
              <td class="py-2 pr-4 font-bold text-phosphor">STORAGE DEV:</td>
              <td class="py-2 text-chrome">OpenMediaVault NAS bind mount (192.168.50.174)</td>
            </tr>
            <tr class="border-b border-gridColor/50">
              <td class="py-2 pr-4 font-bold text-phosphor">REVERSE PROXY:</td>
              <td class="py-2 text-chrome">Cloudflare Tunnel (blog.enderthoughts.com) + Nginx</td>
            </tr>
            <tr>
              <td class="py-2 pr-4 font-bold text-phosphor">SOFTWARE STACK:</td>
              <td class="py-2 text-chrome">Vue 3 / Express / Sharp / MySQL 8 / Docker Compose</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="p-4 select-none text-center font-label text-xs text-dust">
        // END OF TRANSMISSION // VERSION 1.0 //
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'About'
};
</script>
