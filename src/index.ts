import { init } from './app';

function main() {
  const canvas = document.getElementById('canvas') as HTMLCanvasElement | undefined;
  if (!canvas) {
    throw new Error('Canvas not found');
  }
  const dragOverlay = document.getElementById('drag-overlay') as HTMLElement | undefined;
  if (!dragOverlay) {
    throw new Error('Drag overlay not found');
  }
  const clearButton = document.getElementById('clear-button') as HTMLButtonElement | undefined;
  if (!clearButton) {
    throw new Error('Clear button not found');
  }

  init({ canvas, dragOverlay, clearButton }).catch((error) => console.error(error));
}

main();
