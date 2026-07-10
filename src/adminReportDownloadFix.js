import { getSupabaseClient } from './lib/supabaseClient.js';

async function handleReportDownload(event) {
  const button = event.target?.closest?.('[data-action="open-report"][data-report-path]');
  if (!button) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (button.dataset.downloading === 'true') return;

  const storagePath = button.dataset.reportPath;
  const originalLabel = button.textContent;
  button.dataset.downloading = 'true';
  button.disabled = true;
  button.textContent = 'Подготавливаем PDF...';

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.storage
      .from('lead-reports')
      .createSignedUrl(storagePath, 120);

    if (error || !data?.signedUrl) {
      throw error || new Error('Не удалось получить ссылку на PDF.');
    }

    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error(`PDF download failed: ${response.status}`);

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filenameFromPath(storagePath);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

    button.textContent = 'PDF скачан';
    setTimeout(() => {
      button.textContent = originalLabel;
    }, 1800);
  } catch (error) {
    console.error('Report download failed', error);
    button.textContent = 'Ошибка загрузки';
    alert('Не удалось скачать PDF. Обновите CRM и попробуйте ещё раз.');
    setTimeout(() => {
      button.textContent = originalLabel;
    }, 2200);
  } finally {
    button.dataset.downloading = 'false';
    button.disabled = false;
  }
}

function filenameFromPath(path = '') {
  const raw = String(path).split('/').pop() || `solatrix-roof-check-${Date.now()}.pdf`;
  return raw.toLowerCase().endsWith('.pdf') ? raw : `${raw}.pdf`;
}

document.addEventListener('click', handleReportDownload, true);
