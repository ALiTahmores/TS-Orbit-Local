// Escape closes the topmost open dialog. Dialogs across the app are fixed
// full-screen overlays with their own close control, so the handler presses that
// control: an explicit [data-dialog-close], a button labelled "close", the
// icon-only button with the X icon, or a plain Close/Cancel button. Nothing
// happens when no dialog is open.
const CLOSE_LABEL = /^(?:بستن|close|cancel|انصراف)/i;
const CLOSE_TEXT = /^(?:بستن|بستن پنجره|انصراف|close|cancel)$/i;

const visible = (element: HTMLElement) => {
  const box = element.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return false;
  const style = getComputedStyle(element);
  return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0;
};
const layer = (element: HTMLElement) => Number.parseInt(getComputedStyle(element).zIndex, 10) || 0;

function closeControl(overlay: HTMLElement): HTMLElement | null {
  const explicit = overlay.querySelector<HTMLElement>('[data-dialog-close]');
  if (explicit) return explicit;
  const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button')].filter(button => !button.disabled && visible(button));
  return buttons.find(button => CLOSE_LABEL.test(button.getAttribute('aria-label') || button.title || ''))
    || buttons.find(button => !button.innerText.trim() && button.querySelector('svg[class*="lucide-x"]'))
    || buttons.find(button => CLOSE_TEXT.test(button.innerText.trim()))
    || null;
}

export function installDialogKeyboard() {
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
    const overlays = [...document.querySelectorAll<HTMLElement>('.fixed.inset-0')]
      .filter(visible)
      .map((element, order) => ({ element, order, z: layer(element) }))
      .sort((a, b) => b.z - a.z || b.order - a.order);
    for (const { element } of overlays) {
      const control = closeControl(element);
      if (!control) continue;
      event.preventDefault();
      control.click();
      return;
    }
  });
}
