function blockDirectPdfOpening(event) {
  const pdfTrigger = event.target?.closest?.('[data-action="generatePdf"]');
  if (!pdfTrigger) return;

  event.preventDefault();
  event.stopImmediatePropagation();
}

function updateDeliveryConfirmation() {
  document.querySelectorAll('[data-report-success]').forEach((node) => {
    if (node.hidden || node.dataset.deliveryMessageUpdated === 'true') return;

    const existingTitle = node.querySelector('b')?.textContent?.trim() || 'הבקשה התקבלה.';
    node.innerHTML = `
      <b>${escapeHtml(existingTitle)}</b>
      <span>תודה. הבקשה התקבלה והדוח יישלח למספר ה-WhatsApp שהזנתם לאחר השלמת ההכנה.</span>
    `;
    node.dataset.deliveryMessageUpdated = 'true';
  });
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

document.addEventListener('click', blockDirectPdfOpening, true);

const observer = new MutationObserver(updateDeliveryConfirmation);
observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden']
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateDeliveryConfirmation);
} else {
  updateDeliveryConfirmation();
}
