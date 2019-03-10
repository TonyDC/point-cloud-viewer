import { WebGLRenderer } from 'three';

// WebGL 2
// const canvas = document.createElement('canvas');
// const context = canvas.getContext('webgl2');

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

export default renderer;
