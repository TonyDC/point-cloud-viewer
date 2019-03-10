import { PerspectiveCamera } from 'three';

const nearFrustum = 0.1;
const farFrustum = 1000;
const fovDegrees = 75;

const camera = new PerspectiveCamera(
    fovDegrees, window.innerWidth / window.innerHeight,
    nearFrustum, farFrustum,
);

export default camera;
