import api from './api';

// Downloads a gallery zip through the authenticated API (plain <a href> can't
// send the Bearer token) and hands it to the browser as a file save.
export async function downloadGalleryZip(zone, galleryId, fallbackName) {
  const res = await api.get(`/${zone}/galleries/${galleryId}/download`, { responseType: 'blob' });

  const disposition = res.headers['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/);
  const filename = match ? match[1] : `${fallbackName || 'gallery'}.zip`;

  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
