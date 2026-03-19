// ============================================================
// BACKGROUND SERVICE WORKER
// ============================================================

console.log('[JESUS EXTENSION] Background service worker loaded');

// Listen for messages from content script (if needed in future)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[JESUS EXTENSION] Message received:', message);
  
  if (message.type === 'question_detected') {
    console.log('[JESUS EXTENSION] Question detected:', message.data);
  }
  
  sendResponse({ success: true });
  return true;
});

// Extension installed/updated
chrome.runtime.onInstalled.addListener(() => {
  console.log('[JESUS EXTENSION] Extension installed/updated');
});
