export const refreshInventory = () => {
  window.dispatchEvent(new CustomEvent('inventory-updated'))
}
