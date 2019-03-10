import { BoxGeometry, MeshBasicMaterial, Mesh } from 'three';

const geometry = new BoxGeometry(1, 1, 1);
const material = new MeshBasicMaterial({ color: 0x00ff00 });
const cube = new Mesh(geometry, material);

export default cube;
