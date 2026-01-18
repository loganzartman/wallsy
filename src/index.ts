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

  const selectedPictureControls = document.getElementById('selected-picture-controls') as HTMLElement | undefined;
  if (!selectedPictureControls) {
    throw new Error('Selected picture controls not found');
  }
  const selectedPictureWidth = document.getElementById('selected-picture-width') as HTMLInputElement | undefined;
  if (!selectedPictureWidth) {
    throw new Error('Selected picture width not found');
  }
  const selectedPictureHeight = document.getElementById('selected-picture-height') as HTMLInputElement | undefined;
  if (!selectedPictureHeight) {
    throw new Error('Selected picture height not found');
  }
  const selectedPictureDelete = document.getElementById('selected-picture-delete') as HTMLButtonElement | undefined;
  if (!selectedPictureDelete) {
    throw new Error('Selected picture delete not found');
  }
  const selectedPictureClone = document.getElementById('selected-picture-clone') as HTMLButtonElement | undefined;
  if (!selectedPictureClone) {
    throw new Error('Selected picture clone not found');
  }

  init({
    canvas,
    dragOverlay,
    clearButton,
    selectedPictureControls,
    selectedPictureWidth,
    selectedPictureHeight,
    selectedPictureDelete,
    selectedPictureClone,
  }).catch((error) => console.error(error));
}

main();
